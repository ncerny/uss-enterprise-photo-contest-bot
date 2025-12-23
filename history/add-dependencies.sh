#!/bin/bash
# Script to add dependencies between research spikes and implementation tasks
# Research spikes should block their related implementation tasks

set -e

echo "Adding Epic 1 dependencies..."
# RS-1.1 blocks T-1.7 (Discord bot config)
bd dep add photo-9cx.7 photo-9cx.1

# RS-1.2 blocks T-1.6 (Firebase setup)
bd dep add photo-9cx.6 photo-9cx.2

# RS-1.3 blocks Web App OAuth (Epic 8)
bd dep add photo-471.6 photo-9cx.3

# RS-1.4 blocks T-5.6 (image upload/compression)
bd dep add photo-7ht.6 photo-9cx.4

echo "Adding Epic 2 dependencies..."
# RS-2.1 blocks T-2.5 (security rules)
bd dep add photo-ovf.5 photo-ovf.1

# RS-2.2 blocks T-2.6 (indexes)
bd dep add photo-ovf.6 photo-ovf.2

echo "Adding Epic 3 dependencies..."
# RS-3.1 blocks T-3.2 (slash command registry)
bd dep add photo-0fc.5 photo-0fc.1

# RS-3.2 blocks T-4.2 (modal forms)
bd dep add photo-02d.2 photo-0fc.2

# RS-3.3 blocks T-3.7 (error handling)
bd dep add photo-0fc.7 photo-0fc.3

echo "Adding Epic 5 dependencies..."
# RS-5.1 blocks T-5.4 (message watcher)
bd dep add photo-7ht.4 photo-7ht.1

# RS-5.2 blocks T-5.6 (Firebase Storage upload)
bd dep add photo-7ht.6 photo-7ht.2

# RS-5.3 blocks T-5.6 (image compression)
bd dep add photo-7ht.6 photo-7ht.3

echo "Adding Epic 6 dependencies..."
# RS-6.1 blocks T-6.3 (reaction voting)
bd dep add photo-6sc.5 photo-6sc.1

# RS-6.2 blocks T-6.4 (vote tracking)
bd dep add photo-6sc.6 photo-6sc.2

echo "Adding Epic 8 dependencies..."
# RS-8.1 blocks T-8.5 (Firebase SDK setup)
bd dep add photo-471.5 photo-471.1

# RS-8.2 blocks T-8.6 (OAuth flow) - already added above
# bd dep add photo-471.6 photo-471.2

# RS-8.3 blocks T-8.10 (responsive layout)
bd dep add photo-471.10 photo-471.3

echo "Adding epic-level dependencies..."
# Epic 2 depends on Epic 1
bd dep add photo-ovf photo-9cx

# Epic 3 depends on Epic 1 and 2
bd dep add photo-0fc photo-9cx
bd dep add photo-0fc photo-ovf

# Epic 4 depends on Epic 2 and 3
bd dep add photo-02d photo-ovf
bd dep add photo-02d photo-0fc

# Epic 5 depends on Epic 2 and 3
bd dep add photo-7ht photo-ovf
bd dep add photo-7ht photo-0fc

# Epic 6 depends on Epic 5
bd dep add photo-6sc photo-7ht

# Epic 7 depends on Epic 6
bd dep add photo-f6z photo-6sc

# Epic 8 depends on Epic 1 and 2
bd dep add photo-471 photo-9cx
bd dep add photo-471 photo-ovf

# Epic 9 depends on Epic 8
bd dep add photo-u61 photo-471

# Epic 10 depends on all implementation epics (1-9)
bd dep add photo-3zm photo-9cx
bd dep add photo-3zm photo-ovf
bd dep add photo-3zm photo-0fc
bd dep add photo-3zm photo-02d
bd dep add photo-3zm photo-7ht
bd dep add photo-3zm photo-6sc
bd dep add photo-3zm photo-f6z
bd dep add photo-3zm photo-471
bd dep add photo-3zm photo-u61

# Epic 11 can run in parallel but final docs depend on all
bd dep add photo-110 photo-9cx
bd dep add photo-110 photo-ovf
bd dep add photo-110 photo-0fc
bd dep add photo-110 photo-02d
bd dep add photo-110 photo-7ht
bd dep add photo-110 photo-6sc
bd dep add photo-110 photo-f6z
bd dep add photo-110 photo-471
bd dep add photo-110 photo-u61

echo "All dependencies added successfully!"
echo "Run 'bd ready' to see unblocked issues ready to start"
