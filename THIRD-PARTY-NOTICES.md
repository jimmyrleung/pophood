# Third-party notices

Pophood 0.2.0 is built from source and bundles the components below. Versions are the ones in `helper/packages.lock.json`, `src-tauri/Cargo.lock` and `package-lock.json`. This file lists each bundled component with its version, licence, copyright and source location. The full licence texts are in each project's source tree (and, for LibreHardwareMonitor and the PawnIO modules, in `third_party/LibreHardwareMonitor/LICENSE` and `third_party/LibreHardwareMonitor/THIRD-PARTY-NOTICES.txt`). A generated notice list for every transitive Rust and npm package, with the full texts bundled in the installer, is due before a public release.

Pophood itself is released under the MIT licence (see `LICENSE`).

## Sensor helper (pophood-sensors.exe)

### LibreHardwareMonitor 0.9.6

- Licence: MPL-2.0
- Copyright: LibreHardwareMonitor contributors (see the licence files in the source tree)
- Built from source, unmodified, as the git submodule `third_party/LibreHardwareMonitor` at commit `3d331e3370efb858411f19511373eff65a218701` (tag v0.9.6).
- Source location (MPL-2.0 section 3.2): https://github.com/LibreHardwareMonitor/LibreHardwareMonitor at that commit; the same files are in this repository's submodule.

### PawnIO modules (embedded in LibreHardwareMonitor)

- Licence: LGPL-2.1
- Copyright: the PawnIO.Modules authors
- The module binaries are embedded as resources of LibreHardwareMonitorLib. Source: https://github.com/namazso/PawnIO.Modules. The licence text is in `third_party/LibreHardwareMonitor/THIRD-PARTY-NOTICES.txt`.

### DiskInfoToolkit 1.1.2

- Licence: MPL-2.0
- Copyright: Florian K. (Blacktempel)
- Source: https://github.com/Blacktempel/DiskInfoToolkit (commit 25319eae5781e75bcf141e844ceab2afe94d40ea)

### RAMSPDToolkit-NDD 1.4.2

- Licence: MPL-2.0
- Copyright: Florian K. (Blacktempel)
- Source: https://github.com/Blacktempel/RAMSPDToolkit (commit 3b47b960e0830fef344624ad5e389675d5f0a1ce)

### BlackSharp.Core 1.0.7

- Licence: MPL-2.0
- Copyright: Florian K. (Blacktempel)
- Source: https://github.com/Blacktempel/BlackSharp (commit c70b735c6cec123ee8a046ac4a0bc6c606f52cf0)

### HidSharp 2.6.4

- Licence: Apache-2.0
- Copyright: 2010-2025 James Bellinger
- Source: https://software.seekye.com/hidsharp (NuGet package `HidSharp`; the project URL from its nuspec)

### System.Management 10.0.2 and the other Microsoft packages in the helper's closure

System.IO.Ports 10.0.3, System.IO.FileSystem.AccessControl 5.0.0, System.CodeDom 10.0.2, Microsoft.Win32.Registry 5.0.0 and the native runtime packs of System.IO.Ports.

- Licence: MIT
- Copyright: Microsoft Corporation. All rights reserved.
- Source: https://github.com/dotnet/dotnet (the repository named in the package nuspec)

### Mono.Posix.NETStandard 1.0.0

- Licence: MIT
- Copyright: Microsoft Corporation. All rights reserved.
- Source: https://github.com/mono/mono (NuGet package `Mono.Posix.NETStandard`). Its native helper DLLs are not shipped: only `pophood-sensors.exe` is staged.

### .NET NativeAOT runtime (Microsoft.DotNet.ILCompiler 10.0.13)

- Licence: MIT
- Copyright: Microsoft Corporation. All rights reserved.
- The runtime is compiled into `pophood-sensors.exe`. Source: https://github.com/dotnet/runtime

## App (pophood.exe)

### Tauri 2.12.4, tauri-plugin-single-instance 2.5.4

- Licence: MIT OR Apache-2.0
- Copyright: 2017 - Present Tauri Apps Contributors; The Tauri Programme in the Commons Conservancy
- Source: https://github.com/tauri-apps/tauri and https://github.com/tauri-apps/plugins-workspace

### wry 0.57.0

- Licence: MIT OR Apache-2.0
- Copyright: 2020-2023 Ngo Iok Ui and Tauri Programme within The Commons Conservancy
- Source: https://github.com/tauri-apps/wry

### tao 0.37.1

- Licence: Apache-2.0
- Copyright: 2021-2023 The Tauri Programme in the Commons Conservancy
- Source: https://github.com/tauri-apps/tao

### webview2-com 0.39.1

- Licence: MIT
- Copyright: the webview2-rs authors
- Source: https://github.com/wravery/webview2-rs

### windows (windows-rs) 0.62.2

- Licence: MIT OR Apache-2.0
- Copyright: Microsoft Corporation
- Source: https://github.com/microsoft/windows-rs

### tokio 1.54.0

- Licence: MIT
- Copyright: Tokio Contributors
- Source: https://github.com/tokio-rs/tokio

### serde 1.0.229 and serde_json 1.0.154

- Licence: MIT OR Apache-2.0
- Copyright: Erick Tryzelaar and David Tolnay
- Source: https://github.com/serde-rs/serde and https://github.com/serde-rs/json

### sha2 0.10.9

- Licence: MIT OR Apache-2.0
- Copyright: RustCrypto Developers
- Source: https://github.com/RustCrypto/hashes

### getrandom 0.3.4

- Licence: MIT OR Apache-2.0
- Copyright: 2018-2025 The rust-random Project Developers; 2014 The Rust Project Developers
- Source: https://github.com/rust-random/getrandom

## User interface

### React and React DOM 19.3.1

- Licence: MIT
- Copyright: Meta Platforms, Inc. and affiliates
- Source: https://github.com/facebook/react

### @tauri-apps/api 2.12.4

- Licence: MIT OR Apache-2.0
- Copyright: 2017 - Present Tauri Apps Contributors; 2019-2025 The Tauri Programme in the Commons Conservancy
- Source: https://github.com/tauri-apps/tauri

### IBM Plex Sans and IBM Plex Mono (via @fontsource 5.3.0)

- Licence: SIL Open Font License 1.1 (OFL-1.1)
- Copyright: 2019 IBM Corp. (Plex Sans); 2017 IBM Corp. (Plex Mono). All rights reserved.
- Source: https://github.com/IBM/plex. The font files are bundled as `.woff2` assets.

### Fontsource 5.3.0 (packaging of the fonts)

- Licence: MIT
- Copyright: the Fontsource contributors
- Source: https://github.com/fontsource/font-files

## Not shipped, but used or named

- **Microsoft Edge WebView2 Runtime** (Evergreen): installed on the system and updated by Microsoft; Pophood does not bundle it. https://developer.microsoft.com/microsoft-edge/webview2/
- **PawnIO driver 2.2.0** (optional): installed by the user from https://pawnio.eu; Pophood detects it but never installs, loads or manages it.
