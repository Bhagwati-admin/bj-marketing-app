"""Generate PNG app icons at deploy time (repo stays text-only)."""
from PIL import Image, ImageDraw, ImageFont


def make(size, path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=(123, 30, 60, 255))
    font = None
    for fp in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        try:
            font = ImageFont.truetype(fp, int(size * 0.42))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    text = "BJ"
    bb = d.textbbox((0, 0), text, font=font)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((size - w) / 2 - bb[0], (size - h) / 2 - bb[1] - size * 0.02), text, font=font, fill=(232, 190, 90, 255))
    d.rounded_rectangle([size * 0.30, size * 0.72, size * 0.70, size * 0.75], radius=size // 60, fill=(232, 190, 90, 255))
    img.save(path)


make(192, "icon-192.png")
make(180, "apple-touch-icon.png")
print("icons generated")
