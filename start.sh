#!/bin/bash

# autobuild
cd node
./build.sh
cd ..

docker-compose up -d
