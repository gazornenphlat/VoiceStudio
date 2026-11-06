# Mobile MP3 encoder source and relinking

Both mobile apps compile the same LAME 3.100 encoder-only C sources. No encoder
binary, application subprocess, model download, or runtime network call is used.
Audio passes through bounded 8192-frame chunks of mono 24 kHz PCM, producing
64 kbit/s MP3. The caller controls cancellation, temporary files, atomic
publication, and whether the ID3 comment identifies synthetic audio.

The unmodified upstream files are checked into
`mobile/native/mp3/src/Lame`. `source.json` identifies every
upstream file and its SHA-256. The separate portable `config.h` disables decoder,
assembler, SIMD and frontend functionality; all the required encoder sources,
headers, configuration and build instructions are present in this checkout.
The original `COPYING`, `README` and per-file copyright notices are retained.
LAME uses the GNU Library General Public License version 2 or later; see COPYING.

Upstream complete release source:
<https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz>

Archive SHA-256:
`ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e`

Verify the checked-in subset offline:

```sh
python3 mobile/native/mp3/verify_source.py
# Optionally check the subset against a previously downloaded complete archive:
python3 mobile/native/mp3/verify_source.py --archive /path/to/lame-3.100.tar.gz
```

The VoiceStudio application source and build scripts in the same checkout are
also available at <https://github.com/debpalash/VoiceStudio>. Use the source
revision corresponding to the app release. You may modify the encoder and
rebuild/relink the application; no secret application signing key is needed to
build your own development installation. Deliberate source modifications require
updating the matching hashes in `source.json` before running guarded builds.

For Android, `mobile/native/android/CMakeLists.txt` compiles `libvs_mp3.so`
directly from the same encoder sources in `mobile/native/mp3/src`, `Mp3Encoder.c`, and `mp3.c`. Rebuild with
`bash mobile/native/android/build.sh` (NDK 27.1.12297006, API 29, arm64-v8a and
x86_64), then run `./gradlew :app:assembleDebug` in `mobile/android` with JDK 21.
The rebuilt APK contains the replacement shared library and can be installed
using your own key. No proprietary library is needed for the encoder build.

Run `python3 mobile/native/mp3/test_encoder.py` for isolated source-built host
regressions. It verifies real MP3 frames, ID3 provenance, malformed/unfinished
input rejection, and sample-accurate decoded duration when ffmpeg is installed.
