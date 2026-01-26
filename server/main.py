from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import subprocess
import shutil
import time
import sys
import struct
import json
import re
import uuid
import numpy as np
from pathlib import Path
import asyncio
from typing import AsyncGenerator, Dict, Optional
from dataclasses import dataclass, asdict
from enum import Enum

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

# Cleanup settings
CLEANUP_AFTER_SECONDS = 3600  # 1 hour
CLEANUP_INTERVAL_SECONDS = 600  # Run cleanup every 10 minutes


# Job tracking for SSE streaming
class JobStage(str, Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    CLEANING = "cleaning"
    DOWNSAMPLING = "downsampling"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class JobStatus:
    job_id: str
    stage: JobStage
    progress: int  # 0-100
    message: str
    output_file: Optional[str] = None
    error: Optional[str] = None


# Active jobs storage (in-memory for simplicity)
active_jobs: Dict[str, JobStatus] = {}
# Cancelled jobs
cancelled_jobs: set = set()


def cleanup_job_directory(job_id: str):
    """
    Clean up job directories after a short delay (for FileResponse to complete).
    """
    # Wait a bit for the file to be fully sent
    time.sleep(2)

    input_dir = UPLOAD_DIR / job_id
    output_dir = OUTPUT_DIR / job_id

    for directory in [input_dir, output_dir]:
        if directory.exists():
            try:
                shutil.rmtree(directory)
                print(f"[cleanup] Removed job directory: {directory}")
            except Exception as e:
                print(f"[cleanup] Failed to remove {directory}: {e}")


def cleanup_old_files():
    """
    Remove files older than CLEANUP_AFTER_SECONDS from temp directories.
    """
    current_time = time.time()
    cleaned_count = 0

    for temp_dir in [UPLOAD_DIR, OUTPUT_DIR]:
        if not temp_dir.exists():
            continue

        for item in temp_dir.iterdir():
            if item.is_dir():
                # Check modification time of directory
                mtime = item.stat().st_mtime
                age_seconds = current_time - mtime

                if age_seconds > CLEANUP_AFTER_SECONDS:
                    try:
                        shutil.rmtree(item)
                        cleaned_count += 1
                        print(f"[cleanup] Removed old directory: {item} (age: {age_seconds/60:.1f} min)")
                    except Exception as e:
                        print(f"[cleanup] Failed to remove {item}: {e}")

    if cleaned_count > 0:
        print(f"[cleanup] Cleaned up {cleaned_count} old directories")

    return cleaned_count


async def periodic_cleanup():
    """Background task that periodically cleans up old files."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        cleanup_old_files()


@app.on_event("startup")
async def startup_event():
    """Clean up any leftover files from previous runs and start periodic cleanup."""
    cleaned = cleanup_old_files()
    print(f"[startup] Initial cleanup: removed {cleaned} old directories")
    # Start periodic cleanup task
    asyncio.create_task(periodic_cleanup())


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


def format_sse_event(event: str, data: dict) -> str:
    """Format data as Server-Sent Event."""
    result = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    print(f"[SSE] Sending event: {event}, progress: {data.get('progress', '?')}")
    return result


async def run_sharp_with_progress(
    job_id: str,
    job_input_dir: Path,
    job_output_dir: Path,
    quality: int
) -> AsyncGenerator[str, None]:
    """
    Run SHARP conversion with progress streaming via SSE.
    Parses stderr for progress updates.
    """
    # Get the path to the sharp command
    venv_bin = Path(sys.executable).parent
    sharp_cmd = venv_bin / "sharp"

    cmd = [
        str(sharp_cmd), "predict",
        "-i", str(job_input_dir),
        "-o", str(job_output_dir)
    ]

    print(f"[SSE] Running: {' '.join(cmd)}")

    # Update job status
    active_jobs[job_id] = JobStatus(
        job_id=job_id,
        stage=JobStage.PROCESSING,
        progress=0,
        message="Starting SHARP conversion..."
    )
    yield format_sse_event("progress", asdict(active_jobs[job_id]))

    try:
        # Run subprocess with async pipes
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(Path.cwd())
        )

        # Track progress from stderr
        progress = 0
        stderr_output = []

        async def read_stderr():
            nonlocal progress
            buffer = ""
            while True:
                try:
                    # Use read() with chunk size instead of readline() to avoid
                    # LimitOverrunError when SHARP outputs very long lines (>64KB)
                    chunk = await process.stderr.read(8192)  # 8KB chunks
                    if not chunk:
                        break

                    # Decode and add to buffer
                    buffer += chunk.decode('utf-8', errors='ignore')

                    # Process complete lines from buffer
                    while '\n' in buffer:
                        line_text, buffer = buffer.split('\n', 1)
                        line_text = line_text.strip()
                        if line_text:
                            stderr_output.append(line_text)
                            # Only print first 200 chars to avoid log spam
                            print(f"[SHARP] {line_text[:200]}{'...' if len(line_text) > 200 else ''}")

                            # Parse progress from SHARP output
                            progress_match = re.search(r'(\d+)%', line_text)
                            if progress_match:
                                progress = int(progress_match.group(1))
                            elif 'loading' in line_text.lower():
                                progress = 10
                            elif 'predicting' in line_text.lower() or 'processing' in line_text.lower():
                                progress = min(progress + 5, 80)
                            elif 'saving' in line_text.lower():
                                progress = 85

                    # Check for cancellation
                    if job_id in cancelled_jobs:
                        process.terminate()
                        raise asyncio.CancelledError("Job cancelled by user")

                except asyncio.LimitOverrunError:
                    # If we still hit the limit, drain the buffer and continue
                    print("[SHARP] Warning: Large output chunk, draining buffer")
                    try:
                        await process.stderr.read(65536)  # Drain up to 64KB
                    except:
                        pass
                    continue

        # Start reading stderr in background
        stderr_task = asyncio.create_task(read_stderr())

        # Send periodic progress updates with time-based simulation
        # SHARP typically takes 60-180 seconds depending on image size and quality
        start_time = time.time()
        last_progress = 0

        while not stderr_task.done():
            if job_id in cancelled_jobs:
                process.terminate()
                raise asyncio.CancelledError("Job cancelled by user")

            # Calculate time-based progress using asymptotic function
            # This approaches but never reaches 80% until SHARP completes
            # Formula: progress = 80 * (1 - e^(-elapsed/120))
            # At 60s: ~33%, at 120s: ~50%, at 180s: ~63%, at 240s: ~72%
            elapsed = time.time() - start_time
            time_progress = int(80 * (1 - 2.718281828 ** (-elapsed / 120)))

            # Use the higher of time-based or parsed progress
            display_progress = max(progress, time_progress, last_progress)
            # Cap at 79% - never hit 80% until SHARP actually completes
            display_progress = min(79, display_progress)
            last_progress = display_progress

            # Generate appropriate message based on progress
            if display_progress < 15:
                message = "Loading SHARP model..."
            elif display_progress < 35:
                message = "Processing image..."
            elif display_progress < 55:
                message = "Generating gaussians..."
            elif display_progress < 70:
                message = "Refining splats..."
            else:
                message = "Finalizing output..."

            active_jobs[job_id] = JobStatus(
                job_id=job_id,
                stage=JobStage.PROCESSING,
                progress=display_progress,
                message=message
            )
            yield format_sse_event("progress", asdict(active_jobs[job_id]))
            await asyncio.sleep(0.5)

        # Wait for process to complete
        await stderr_task
        await process.wait()

        if process.returncode != 0:
            stderr_text = '\n'.join(stderr_output)
            raise Exception(f"SHARP failed with code {process.returncode}: {stderr_text}")

        print("[SSE] SHARP completed successfully")

        # Find the output PLY file
        files = list(job_output_dir.glob("*.ply"))
        if not files:
            files = list(job_output_dir.rglob("*.ply"))
        if not files:
            raise Exception("No PLY file generated")

        raw_ply = files[0]

        # Cleaning stage
        active_jobs[job_id] = JobStatus(
            job_id=job_id,
            stage=JobStage.CLEANING,
            progress=90,
            message="Cleaning PLY file..."
        )
        yield format_sse_event("progress", asdict(active_jobs[job_id]))

        cleaned_ply = job_output_dir / f"cleaned_{raw_ply.name}"
        clean_ply_for_viewer(raw_ply, cleaned_ply)

        # Downsampling stage (if needed)
        if quality < 100:
            active_jobs[job_id] = JobStatus(
                job_id=job_id,
                stage=JobStage.DOWNSAMPLING,
                progress=95,
                message=f"Downsampling to {quality}%..."
            )
            yield format_sse_event("progress", asdict(active_jobs[job_id]))

            downsampled_ply = job_output_dir / f"downsampled_{raw_ply.name}"
            downsample_ply(cleaned_ply, downsampled_ply, quality)
            output_file = downsampled_ply
        else:
            output_file = cleaned_ply

        # Complete
        active_jobs[job_id] = JobStatus(
            job_id=job_id,
            stage=JobStage.COMPLETE,
            progress=100,
            message="Conversion complete!",
            output_file=str(output_file)
        )
        yield format_sse_event("complete", asdict(active_jobs[job_id]))

    except asyncio.CancelledError:
        active_jobs[job_id] = JobStatus(
            job_id=job_id,
            stage=JobStage.ERROR,
            progress=0,
            message="Conversion cancelled",
            error="Cancelled by user"
        )
        yield format_sse_event("error", asdict(active_jobs[job_id]))
        # Cleanup
        for directory in [job_input_dir, job_output_dir]:
            if directory.exists():
                shutil.rmtree(directory)
    except Exception as e:
        print(f"[SSE] Error: {e}")
        active_jobs[job_id] = JobStatus(
            job_id=job_id,
            stage=JobStage.ERROR,
            progress=0,
            message="Conversion failed",
            error=str(e)
        )
        yield format_sse_event("error", asdict(active_jobs[job_id]))


@app.post("/convert-stream")
async def convert_image_stream(
    file: UploadFile = File(...),
    quality: int = Form(default=100),
):
    """
    Convert image to PLY with SSE progress streaming.
    Returns an SSE stream with progress events.
    Final event includes the job_id to fetch the result.
    """
    # Clamp quality
    quality = max(5, min(100, quality))

    # Generate unique job ID
    job_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
    job_input_dir = UPLOAD_DIR / job_id
    job_output_dir = OUTPUT_DIR / job_id

    job_input_dir.mkdir(parents=True, exist_ok=True)
    job_output_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded file
    input_path = job_input_dir / file.filename
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    print(f"[SSE] Saved file: {input_path}, quality: {quality}%")

    # Initialize job status
    active_jobs[job_id] = JobStatus(
        job_id=job_id,
        stage=JobStage.UPLOADING,
        progress=0,
        message="File uploaded, starting conversion..."
    )

    async def generate():
        # Send initial event immediately
        yield format_sse_event("progress", asdict(active_jobs[job_id]))

        async for event in run_sharp_with_progress(job_id, job_input_dir, job_output_dir, quality):
            yield event

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream",
            "Transfer-Encoding": "chunked",
        }
    )


@app.get("/job/{job_id}/result")
async def get_job_result(job_id: str, background_tasks: BackgroundTasks = None):
    """
    Download the result of a completed conversion job.
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = active_jobs[job_id]

    if job.stage != JobStage.COMPLETE:
        raise HTTPException(status_code=400, detail=f"Job not complete. Current stage: {job.stage}")

    if not job.output_file:
        raise HTTPException(status_code=500, detail="No output file available")

    output_path = Path(job.output_file)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    # Schedule cleanup after download
    if background_tasks:
        background_tasks.add_task(cleanup_job_directory, job_id)

    return FileResponse(
        output_path,
        filename=f"splat_{job_id}.ply",
        media_type="application/octet-stream"
    )


@app.post("/job/{job_id}/cancel")
async def cancel_job(job_id: str):
    """
    Cancel a running conversion job.
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    cancelled_jobs.add(job_id)
    return {"status": "cancelled", "job_id": job_id}


@app.get("/job/{job_id}/status")
async def get_job_status(job_id: str):
    """
    Get the current status of a job.
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return asdict(active_jobs[job_id])


@app.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    quality: int = Form(default=100),
    background_tasks: BackgroundTasks = None
):
    """
    Accepts an image file, runs SHARP to convert it to a gaussian splat PLY.
    Quality parameter controls downsampling (5-100% of splats to keep).
    Returns the cleaned and optionally downsampled PLY file.
    (Non-streaming version for backwards compatibility)
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

        # Schedule cleanup of job directories after response is sent
        if background_tasks:
            background_tasks.add_task(cleanup_job_directory, job_id)

        return FileResponse(output_file, filename=f"splat_{job_id}.ply", media_type="application/octet-stream")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

        # Clean up on error
        for directory in [job_input_dir, job_output_dir]:
            if directory.exists():
                try:
                    shutil.rmtree(directory)
                    print(f"[cleanup] Removed failed job directory: {directory}")
                except Exception as cleanup_error:
                    print(f"[cleanup] Failed to clean up {directory}: {cleanup_error}")

        raise HTTPException(status_code=500, detail=str(e))


# ==================== Cleanup Endpoints ====================

@app.post("/cleanup/sharp-model")
async def cleanup_sharp_model():
    """
    Delete the SHARP model cache (~2.6GB) from ~/.cache/torch/hub/checkpoints/
    This frees up disk space but the model will need to re-download on next conversion.
    """
    cache_dir = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"

    deleted_files = []
    total_size = 0

    if cache_dir.exists():
        for f in cache_dir.iterdir():
            if f.is_file():
                # Check for SHARP model files - the filename might be:
                # - sharp_*.pt (original name)
                # - A hash-based name for large models
                # We check for 'sharp' OR files > 1GB (likely the SHARP model)
                is_sharp = 'sharp' in f.name.lower()
                is_large_model = f.name.endswith('.pt') and f.stat().st_size > 1_000_000_000  # > 1GB

                if is_sharp or is_large_model:
                    size = f.stat().st_size
                    total_size += size
                    f.unlink()
                    deleted_files.append(f.name)
                    print(f"[cleanup] Deleted model file: {f.name} ({size / (1024*1024):.1f} MB)")

    return {
        "status": "success",
        "deleted_files": deleted_files,
        "freed_bytes": total_size,
        "freed_mb": round(total_size / (1024 * 1024), 2)
    }


@app.post("/cleanup/temp-files")
async def cleanup_temp_files():
    """
    Delete all temporary upload and output files.
    """
    deleted_count = 0
    total_size = 0

    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        if directory.exists():
            for item in directory.iterdir():
                if item.is_dir():
                    size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())
                    total_size += size
                    shutil.rmtree(item)
                    deleted_count += 1
                elif item.is_file():
                    total_size += item.stat().st_size
                    item.unlink()
                    deleted_count += 1

    return {
        "status": "success",
        "deleted_items": deleted_count,
        "freed_bytes": total_size,
        "freed_mb": round(total_size / (1024 * 1024), 2)
    }


@app.post("/cleanup/all")
async def cleanup_all():
    """
    Full cleanup: delete SHARP model, temp files, and installation directory.
    Returns instructions for completing cleanup (stopping servers, removing ~/.splat-window).
    """
    sharp_result = await cleanup_sharp_model()
    temp_result = await cleanup_temp_files()

    total_freed = sharp_result["freed_bytes"] + temp_result["freed_bytes"]

    return {
        "status": "success",
        "sharp_cleanup": sharp_result,
        "temp_cleanup": temp_result,
        "total_freed_mb": round(total_freed / (1024 * 1024), 2),
        "manual_steps": [
            "To stop servers: Press Ctrl+C in the terminal running splat-viewer",
            "To remove installation: rm -rf ~/.splat-window",
            "To remove settings: Clear browser localStorage for this site"
        ]
    }


@app.get("/status/storage")
async def get_storage_status():
    """
    Get current storage usage for SHARP model and temp files.
    """
    # Check SHARP model cache
    cache_dir = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"
    sharp_size = 0
    sharp_files = []

    if cache_dir.exists():
        for f in cache_dir.iterdir():
            if f.is_file():
                # Same detection logic as cleanup
                is_sharp = 'sharp' in f.name.lower()
                is_large_model = f.name.endswith('.pt') and f.stat().st_size > 1_000_000_000  # > 1GB

                if is_sharp or is_large_model:
                    size = f.stat().st_size
                    sharp_size += size
                    sharp_files.append({"name": f.name, "size_mb": round(size / (1024 * 1024), 2)})

    # Check temp directories
    temp_size = 0
    temp_count = 0

    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        if directory.exists():
            for item in directory.rglob('*'):
                if item.is_file():
                    temp_size += item.stat().st_size
                    temp_count += 1

    # Check installation directory
    install_dir = Path.home() / ".splat-window"
    install_size = 0

    if install_dir.exists():
        for item in install_dir.rglob('*'):
            if item.is_file():
                install_size += item.stat().st_size

    return {
        "sharp_model": {
            "size_mb": round(sharp_size / (1024 * 1024), 2),
            "files": sharp_files,
            "installed": len(sharp_files) > 0
        },
        "temp_files": {
            "size_mb": round(temp_size / (1024 * 1024), 2),
            "file_count": temp_count
        },
        "installation": {
            "size_mb": round(install_size / (1024 * 1024), 2),
            "path": str(install_dir),
            "exists": install_dir.exists()
        },
        "total_size_mb": round((sharp_size + temp_size + install_size) / (1024 * 1024), 2)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
