"""Run as its own process so a slow or stuck conversion can be killed: pdf_to_docx.py in.pdf out.docx"""

import logging
import sys

from pdf2docx import Converter

logging.disable(logging.CRITICAL)  # pdf2docx logs page text at INFO

src, dst = sys.argv[1], sys.argv[2]
cv = Converter(src)
try:
    cv.convert(dst, multi_processing=False)
finally:
    cv.close()
