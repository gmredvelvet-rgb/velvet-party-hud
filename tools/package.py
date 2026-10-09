"""Build a deterministic Foundry ZIP from an explicit runtime allowlist."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / "module.json").read_text(encoding="utf-8-sig"))
version = manifest["version"]
assert re.fullmatch(r"\d+\.\d+\.\d+", version), "Use a stable semantic version"
assert manifest["id"] == "velvet-party-hud"
assert manifest["download"].endswith(f"/v{version}/module.zip"), "Release URL version mismatch"
assert any(dep["id"] == "velvet-license-hub" for dep in manifest["relationships"]["requires"])
files = [ROOT / name for name in ("module.json", "LICENSE", "README.md", "CHANGELOG.md")]
for folder in ("scripts", "styles", "language"):
    files.extend(p for p in (ROOT / folder).rglob("*") if p.is_file())
for name in [*manifest["esmodules"], *manifest["styles"], *(lang["path"] for lang in manifest["languages"])]:
    assert ROOT / name in files, f"Missing runtime asset: {name}"
for language in manifest["languages"]:
    data = json.loads((ROOT / language["path"]).read_text(encoding="utf-8-sig"))
    assert data["VPH"]["license"]["fallback"]
output = ROOT / "dist"
output.mkdir(exist_ok=True)
with zipfile.ZipFile(output / "module.zip", "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(files):
        info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes())
(output / "module.json").write_bytes((ROOT / "module.json").read_bytes())
(output / "SHA256SUMS.txt").write_text("".join(
    f"{hashlib.sha256((output / name).read_bytes()).hexdigest()}  {name}\n"
    for name in ("module.zip", "module.json")
), encoding="utf-8")
print(f"Built Velvet Party HUD {version}: {len(files)} files, {(output / 'module.zip').stat().st_size} bytes")
