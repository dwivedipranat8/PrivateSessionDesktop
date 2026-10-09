// Private Session Mac external-volume observer — PREVIEW / NOT VERIFIED.
// Must be signed/bundled/supervised and physically tested before any sensitive use.
// This helper runs ONLY as a child of the currently enrolled app. It must never
// kill unrelated processes, persist chat data, or identify the person using it.
import Foundation
import Darwin
import DiskArbitration

struct MountSnapshot: Equatable {
    let filesystemDevice: UInt32
    let filesystemId: Data
}

func getMountSnapshot(_ path: String) -> MountSnapshot? {
    var state = statfs()
    let outcome: Int32 = path.withCString { cPath in
        return statfs(cPath, &state)
    }
    guard outcome == 0 else { return nil }
    let idBytes = withUnsafeBytes(of: state.f_fsid) { Data($0) }
    return MountSnapshot(filesystemDevice: UInt32(state.f_fsid.val.0),
                         filesystemId: idBytes)
}

final class VolumeGuard {
    let parent: pid_t
    let mountedPath: String
    let original: MountSnapshot
    var stopped = false

    init(parent: pid_t, mountedPath: String, original: MountSnapshot) {
        self.parent = parent
        self.mountedPath = mountedPath
        self.original = original
    }

    func terminateParent() {
        guard !stopped else { return }
        stopped = true
        // Verify this remains the actual originating parent before signalling.
        if getppid() == parent {
            _ = kill(parent, SIGTERM)
        }
        exit(2)
    }

    func check() {
        if stopped { return }
        if getppid() != parent { exit(0) } // prevent PID-reuse targeting
        guard let present = getMountSnapshot(mountedPath),
              present == original else {
            terminateParent()
            return
        }
    }
}

func diskChanged(_ disk: DADisk, _ context: UnsafeMutableRawPointer?) {
    guard let context else { return }
    let guardObject = Unmanaged<VolumeGuard>.fromOpaque(context).takeUnretainedValue()
    guardObject.check()
}

func diskDescriptionChanged(_ disk: DADisk, _ changedKeys: CFArray, _ context: UnsafeMutableRawPointer?) {
    guard let context else { return }
    let guardObject = Unmanaged<VolumeGuard>.fromOpaque(context).takeUnretainedValue()
    guardObject.check()
}

func main() {
    let args = CommandLine.arguments
    guard args.count == 3, let pid = Int32(args[1]),
          pid > 1, getppid() == pid else { exit(2) }

    let path = URL(fileURLWithPath: args[2]).standardizedFileURL.path
    guard path.hasPrefix("/Volumes/"),
          let snapshot = getMountSnapshot(path) else { exit(2) }

    let guardObject = VolumeGuard(parent: pid, mountedPath: path, original: snapshot)
    guard let daSession = DASessionCreate(kCFAllocatorDefault) else { exit(2) }

    // Registration catches disk disappearances. Periodic mount-ID checks catch
    // unmounts and inaccessible volumes not reflected by a particular callback.
    let context = Unmanaged.passUnretained(guardObject).toOpaque()
    DARegisterDiskDisappearedCallback(daSession, nil, diskChanged, context)
    DARegisterDiskDescriptionChangedCallback(daSession, nil, nil, diskDescriptionChanged, context)
    DASessionScheduleWithRunLoop(daSession, CFRunLoopGetCurrent(), kCFRunLoopDefaultMode!)

    let periodic = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { _ in
        guardObject.check()
    }
    withExtendedLifetime(periodic) {
        guardObject.check()
        RunLoop.current.run()
    }
}

main()
