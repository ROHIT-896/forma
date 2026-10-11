import struct
import zlib
import os
import math

def generate_forma_icon(output_path="build/icon.png", width=1024, height=1024):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # We will generate RGBA pixels
    # Dark rounded squircle with emerald F monogram
    pixels = bytearray(width * height * 4)
    
    cx, cy = width / 2.0, height / 2.0
    # Squircle radius & power
    radius = 410.0
    power = 4.2  # macOS squircle exponent |x/r|^p + |y/r|^p <= 1
    
    for y in range(height):
        # Y from top (0) to bottom (height-1)
        ny = cy - y # +cy at top, -cy at bottom
        for x in range(width):
            nx = x - cx
            idx = (y * width + x) * 4
            
            # Squircle distance
            sq_dist = (abs(nx) / radius) ** power + (abs(ny) / radius) ** power
            
            if sq_dist > 1.05:
                # Outside icon completely (transparent)
                pixels[idx:idx+4] = b'\x00\x00\x00\x00'
                continue
            
            # Anti-aliasing border
            alpha = 1.0
            if sq_dist > 0.96:
                alpha = max(0.0, min(1.0, (1.05 - sq_dist) / 0.09))
            
            # Background gradient: deep slate/graphite (#1A1E27 down to #0B0D12)
            grad_t = y / float(height)
            bg_r = int(24 * (1.0 - grad_t) + 11 * grad_t)
            bg_g = int(28 * (1.0 - grad_t) + 13 * grad_t)
            bg_b = int(38 * (1.0 - grad_t) + 18 * grad_t)
            
            # Inner border glow (around edge of squircle)
            if 0.90 <= sq_dist <= 0.97:
                glow = (1.0 - abs(sq_dist - 0.935) / 0.035) * 0.4
                bg_r = int(bg_r * (1 - glow) + 40 * glow)
                bg_g = int(bg_g * (1 - glow) + 60 * glow)
                bg_b = int(bg_b * (1 - glow) + 80 * glow)
            
            # Stylized FORMA "F" Monogram
            # Vertical spine: x in [330, 420], y in [280, 750] (in image coords)
            in_spine = (330 <= x <= 420) and (280 <= y <= 750)
            # Top bar: x in [330, 700], y in [280, 370]
            in_top = (330 <= x <= 700) and (280 <= y <= 370)
            # Middle bar: x in [330, 600], y in [450, 540]
            in_mid = (330 <= x <= 600) and (450 <= y <= 540)
            # Accent dot: circle at (650, 680), radius 32
            dot_dx = x - 655
            dot_dy = y - 675
            in_dot = (dot_dx*dot_dx + dot_dy*dot_dy) <= (34*34)
            
            if in_spine or in_top or in_mid or in_dot:
                # Vibrant Emerald to Mint gradient (#10B981 to #34D399)
                em_t = (x - 330) / 370.0
                em_t = max(0.0, min(1.0, em_t))
                fg_r = int(16 * (1.0 - em_t) + 52 * em_t)
                fg_g = int(185 * (1.0 - em_t) + 211 * em_t)
                fg_b = int(129 * (1.0 - em_t) + 153 * em_t)
                
                # Soft shadow/bevel highlight at top of bars
                if (in_top and y < 290) or (in_mid and y < 460) or (in_spine and y < 290):
                    fg_r = min(255, fg_r + 40)
                    fg_g = min(255, fg_g + 40)
                    fg_b = min(255, fg_b + 40)
                    
                cur_r, cur_g, cur_b = fg_r, fg_g, fg_b
            else:
                # Drop shadow around glyph
                near_glyph = (
                    (315 <= x <= 715 and 265 <= y <= 765) or
                    ((dot_dx*dot_dx + dot_dy*dot_dy) <= (50*50))
                )
                if near_glyph:
                    bg_r = int(bg_r * 0.7)
                    bg_g = int(bg_g * 0.7)
                    bg_b = int(bg_b * 0.7)
                cur_r, cur_g, cur_b = bg_r, bg_g, bg_b
            
            cur_a = int(alpha * 255)
            pixels[idx] = cur_r
            pixels[idx+1] = cur_g
            pixels[idx+2] = cur_b
            pixels[idx+3] = cur_a
            
    # Encode as standard PNG
    raw_data = bytearray()
    for row in range(height):
        raw_data.append(0) # filter type 0 (None)
        raw_data.extend(pixels[row * width * 4 : (row + 1) * width * 4])
        
    compressed = zlib.compress(raw_data, 9)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n') # PNG signature
    
    def chunk(tag, data):
        length = len(data)
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', length) + tag + data + struct.pack('>I', crc)
        
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr_data))
    # IDAT
    png.extend(chunk(b'IDAT', compressed))
    # IEND
    png.extend(chunk(b'IEND', b''))
    
    with open(output_path, 'wb') as f:
        f.write(png)
        
    print(f"Generated PNG icon successfully: {output_path} ({len(png)} bytes)")

if __name__ == '__main__':
    generate_forma_icon()
