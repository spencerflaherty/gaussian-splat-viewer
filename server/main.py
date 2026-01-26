from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import subprocess
import shutil
import time
import sys
import struct
import numpy as np
from pathlib import Path

app = FastAPI()

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("temp_uploads")
OUTPUT_DIR = Path("temp_outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


@app.get("/")
async def health_check():
    """Health check endpoint for frontend to verify backend is running."""
    return {"status": "ok", "service": "splat-window-backend"}


def clean_ply_for_viewer(input_path: Path, output_path: Path):
    """
    Strip extra metadata from SHARP PLY to make it compatible with gaussian-splats-3d.
    The viewer only needs the vertex element with gaussian splat properties.
    """
    with open(input_path, 'rb') as f:
        content = f.read()

    print(f"[clean_ply] Input file size: {len(content)} bytes")

    # Find header end
    header_end = content.find(b'end_header\n')
    if header_end == -1:
        raise ValueError("Invalid PLY file - no end_header found")

    header = content[:header_end].decode('ascii')
    binary_data = content[header_end + len(b'end_header\n'):]

    print(f"[clean_ply] Header length: {header_end} bytes")
    print(f"[clean_ply] Binary data length: {len(binary_data)} bytes")
    print(f"[clean_ply] Full header:\n{header}\n---END HEADER---")

    # Parse header to find vertex count and property size
    lines = header.split('\n')
    new_header_lines = []
    vertex_count = 0
    vertex_properties = []
    in_vertex_element = False
    skip_elements = {'extrinsic', 'intrinsic', 'image_size', 'frame', 'disparity', 'color_space', 'version'}
    skip_current = False

    for line in lines:
        parts = line.split()
        if not parts:
            # Skip empty lines - they corrupt the PLY format
            continue

        if parts[0] == 'element':
            element_name = parts[1]
            if element_name == 'vertex':
                in_vertex_element = True
                skip_current = False
                vertex_count = int(parts[2])
                print(f"[clean_ply] Found vertex element with {vertex_count} vertices")
                new_header_lines.append(line)
            elif element_name in skip_elements:
                in_vertex_element = False
                skip_current = True
                print(f"[clean_ply] Skipping element: {element_name}")
                # Don't add this line
            else:
                in_vertex_element = False
                skip_current = False
                print(f"[clean_ply] Keeping non-vertex element: {element_name}")
                new_header_lines.append(line)
        elif parts[0] == 'property':
            if skip_current:
                # Skip properties of elements we're removing
                continue
            if in_vertex_element:
                vertex_properties.append(parts)
            new_header_lines.append(line)
        else:
            if not skip_current:
                new_header_lines.append(line)

    # Calculate vertex size based on property types
    type_sizes = {
        'char': 1, 'uchar': 1, 'int8': 1, 'uint8': 1,
        'short': 2, 'ushort': 2, 'int16': 2, 'uint16': 2,
        'int': 4, 'uint': 4, 'int32': 4, 'uint32': 4, 'float': 4, 'float32': 4,
        'double': 8, 'float64': 8
    }

    bytes_per_vertex = 0
    print(f"[clean_ply] Vertex properties ({len(vertex_properties)}):")
    for prop in vertex_properties:
        # prop is ['property', 'type', 'name']
        prop_type = prop[1]
        prop_name = prop[2] if len(prop) > 2 else 'unknown'
        if prop_type not in type_sizes:
            # Fallback for list properties or unknown (though SHARP doesn't allow lists usually)
            print(f"  - {prop_name}: {prop_type} (UNKNOWN - assuming 4 bytes)")
            bytes_per_vertex += 4
        else:
            print(f"  - {prop_name}: {prop_type} ({type_sizes[prop_type]} bytes)")
            bytes_per_vertex += type_sizes[prop_type]

    vertex_data_size = vertex_count * bytes_per_vertex
    print(f"[clean_ply] Bytes per vertex: {bytes_per_vertex}")
    print(f"[clean_ply] Expected vertex data size: {vertex_data_size} bytes")
    print(f"[clean_ply] Actual binary data available: {len(binary_data)} bytes")

    if vertex_data_size > len(binary_data):
        print(f"[clean_ply] WARNING: Not enough binary data! Expected {vertex_data_size}, got {len(binary_data)}")
        # Calculate how many vertices we can actually fit
        actual_vertex_count = len(binary_data) // bytes_per_vertex
        print(f"[clean_ply] Adjusting vertex count from {vertex_count} to {actual_vertex_count}")
        vertex_count = actual_vertex_count
        vertex_data_size = vertex_count * bytes_per_vertex
        # Update the vertex count in the header
        for i, line in enumerate(new_header_lines):
            if line.startswith('element vertex'):
                new_header_lines[i] = f'element vertex {vertex_count}'
                break

    # Extract only the vertex data
    vertex_data = binary_data[:vertex_data_size]

    # Reconstruct the PLY file - filter out any empty lines
    new_header_lines = [line for line in new_header_lines if line.strip()]
    new_header = '\n'.join(new_header_lines) + '\n'

    print(f"[clean_ply] Output header:\n{new_header}---END OUTPUT HEADER---")

    with open(output_path, 'wb') as f:
        f.write(new_header.encode('ascii'))
        f.write(b'end_header\n')
        f.write(vertex_data)

    output_size = output_path.stat().st_size
    print(f"[clean_ply] Output file size: {output_size} bytes")
    print(f"[clean_ply] Final vertex count: {vertex_count}")

    return output_path


def downsample_ply(input_path: Path, output_path: Path, keep_percentage: int):
    """
    Downsample a PLY file by keeping only a percentage of vertices.
    Uses opacity-weighted random sampling to keep the most visible splats.
    """
    with open(input_path, 'rb') as f:
        content = f.read()

    # Find header end
    header_end = content.find(b'end_header\n')
    if header_end == -1:
        raise ValueError("Invalid PLY file - no end_header found")

    header = content[:header_end].decode('ascii')
    binary_data = content[header_end + len(b'end_header\n'):]

    # Parse header
    lines = header.split('\n')
    vertex_count = 0
    properties = []
    opacity_index = -1

    for line in lines:
        parts = line.split()
        if not parts:
            continue
        if parts[0] == 'element' and parts[1] == 'vertex':
            vertex_count = int(parts[2])
        elif parts[0] == 'property':
            prop_name = parts[2] if len(parts) > 2 else ''
            if prop_name == 'opacity':
                opacity_index = len(properties)
            properties.append(prop_name)

    if vertex_count == 0:
        raise ValueError("No vertices found in PLY file")

    bytes_per_vertex = len(properties) * 4  # All floats

    # Calculate how many vertices to keep
    keep_count = max(1, int(vertex_count * keep_percentage / 100))

    print(f"Downsampling: {vertex_count} -> {keep_count} vertices ({keep_percentage}%)")

    if keep_percentage >= 100:
        # No downsampling needed
        shutil.copy(input_path, output_path)
        return output_path

    # Read all vertex data into numpy array
    vertex_data = np.frombuffer(binary_data[:vertex_count * bytes_per_vertex], dtype=np.float32)
    vertex_data = vertex_data.reshape(vertex_count, len(properties))

    # Sample based on opacity (higher opacity = more likely to keep)
    if opacity_index >= 0:
        # Use sigmoid of opacity as weights
        opacities = vertex_data[:, opacity_index]
        # Apply sigmoid to convert from log-odds to probability
        weights = 1 / (1 + np.exp(-opacities))
        # Normalize weights
        weights = weights / weights.sum()
        # Sample without replacement
        indices = np.random.choice(vertex_count, size=keep_count, replace=False, p=weights)
    else:
        # Random sampling if no opacity
        indices = np.random.choice(vertex_count, size=keep_count, replace=False)

    # Sort indices to maintain some spatial coherence
    indices = np.sort(indices)

    # Extract sampled vertices
    sampled_data = vertex_data[indices]

    # Update header with new vertex count - filter empty lines
    new_header_lines = []
    for line in lines:
        if not line.strip():
            continue  # Skip empty lines
        parts = line.split()
        if parts and parts[0] == 'element' and parts[1] == 'vertex':
            new_header_lines.append(f"element vertex {keep_count}")
        else:
            new_header_lines.append(line)

    new_header = '\n'.join(new_header_lines) + '\n'

    # Write output
    with open(output_path, 'wb') as f:
        f.write(new_header.encode('ascii'))
        f.write(b'end_header\n')
        f.write(sampled_data.astype(np.float32).tobytes())

    print(f"Downsampled PLY: {len(new_header_lines)} header lines, {keep_count} vertices")

    return output_path


@app.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    quality: int = Form(default=100)
):
    """
    Accepts an image file, runs SHARP to convert it to a gaussian splat PLY.
    Quality parameter controls downsampling (5-100% of splats to keep).
    Returns the cleaned and optionally downsampled PLY file.
    """
    # Clamp quality to valid range
    quality = max(5, min(100, quality))
    print(f"Received file: {file.filename}, quality: {quality}%")

    # Create temp directory for this request
    job_id = f"{int(time.time())}_{file.filename.rsplit('.', 1)[0]}"
    job_input_dir = UPLOAD_DIR / job_id
    job_output_dir = OUTPUT_DIR / job_id

    job_input_dir.mkdir(parents=True, exist_ok=True)
    job_output_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Save uploaded file
        input_path = job_input_dir / file.filename
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print(f"Saved to {input_path}")

        # Get the path to the sharp command in the same venv as the server
        venv_bin = Path(sys.executable).parent
        sharp_cmd = venv_bin / "sharp"

        cmd = [
            str(sharp_cmd), "predict",
            "-i", str(job_input_dir),
            "-o", str(job_output_dir)
        ]

        print(f"Running: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(Path.cwd())
        )

        if result.returncode != 0:
            print("STDERR:", result.stderr)
            print("STDOUT:", result.stdout)
            raise HTTPException(status_code=500, detail=f"Sharp failed: {result.stderr}")

        print("Sharp completed.")

        # Find the output file
        files = list(job_output_dir.glob("*.ply"))
        if not files:
            files = list(job_output_dir.rglob("*.ply"))

        if not files:
            raise HTTPException(status_code=500, detail="No PLY file generated")

        raw_ply = files[0]

        # Clean the PLY file to make it compatible with gaussian-splats-3d
        cleaned_ply = job_output_dir / f"cleaned_{raw_ply.name}"
        print(f"Cleaning PLY: {raw_ply} -> {cleaned_ply}")
        clean_ply_for_viewer(raw_ply, cleaned_ply)
        print("PLY cleaned successfully")

        # Downsample if quality < 100
        if quality < 100:
            downsampled_ply = job_output_dir / f"downsampled_{raw_ply.name}"
            print(f"Downsampling PLY to {quality}%...")
            downsample_ply(cleaned_ply, downsampled_ply, quality)
            print("PLY downsampled successfully")
            output_file = downsampled_ply
        else:
            output_file = cleaned_ply

        return FileResponse(output_file, filename=f"splat_{job_id}.ply", media_type="application/octet-stream")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
