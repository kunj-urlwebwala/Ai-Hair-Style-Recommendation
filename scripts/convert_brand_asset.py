from pathlib import Path
from PIL import Image

project = Path(__file__).resolve().parents[1]
source = project / "assets" / "images" / "mirror-icon-source.webp"
destination_dir = project / "assets" / "images"

with Image.open(source) as image:
    square = image.convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    for name in ("icon.png", "splash-icon.png", "favicon.png", "android-icon-foreground.png"):
        square.save(destination_dir / name, "PNG", optimize=True)
