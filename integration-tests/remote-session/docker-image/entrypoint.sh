#!/usr/bin/bash

start-stop-daemon -S -b --exec /usr/sbin/sshd -- -D

su yoctouser -c /usr/bin/bash
