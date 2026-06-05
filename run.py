#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 启动脚本
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from src.app import main
if __name__ == "__main__":
    main()