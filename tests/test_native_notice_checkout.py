"""Pinned native notices survive a Windows-style Git checkout byte for byte."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

