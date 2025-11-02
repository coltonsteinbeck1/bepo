#!/bin/bash
# Log Rotation Script
# Automatically rotate and compress old logs

set -e

LOGS_DIR="./logs"
ARCHIVE_DIR="./logs/archive"
MAX_SIZE_MB=50
MAX_AGE_DAYS=7

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting log rotation...${NC}"

# Create archive directory if it doesn't exist
mkdir -p "$ARCHIVE_DIR"

# Function to get file size in MB
get_size_mb() {
    local file=$1
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        stat -f%z "$file" | awk '{print $1/1024/1024}'
    else
        # Linux
        stat -c%s "$file" | awk '{print $1/1024/1024}'
    fi
}

# Function to compress and archive log file
archive_log() {
    local file=$1
    local filename=$(basename "$file")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local archive_name="${filename%.log}_${timestamp}.log.gz"
    
    echo -e "${YELLOW}  Archiving: $filename${NC}"
    
    # Compress and move to archive
    gzip -c "$file" > "$ARCHIVE_DIR/$archive_name"
    
    # Clear the original file (keep it for active logging)
    : > "$file"
    
    echo -e "${GREEN}  ✓ Archived to: $archive_name${NC}"
}

# Rotate logs that exceed size limit
rotated_count=0

for logfile in "$LOGS_DIR"/*.log; do
    if [ -f "$logfile" ]; then
        size=$(get_size_mb "$logfile")
        
        # Check if file exceeds size limit
        if (( $(echo "$size > $MAX_SIZE_MB" | bc -l) )); then
            archive_log "$logfile"
            ((rotated_count++))
        fi
    fi
done

echo -e "${GREEN}✓ Rotated $rotated_count log file(s)${NC}"

# Clean up old archives
echo -e "${BLUE}🗑️  Cleaning up old archives...${NC}"
deleted_count=0

find "$ARCHIVE_DIR" -name "*.log.gz" -type f -mtime "+$MAX_AGE_DAYS" | while read -r archive; do
    echo -e "${YELLOW}  Deleting: $(basename "$archive")${NC}"
    rm "$archive"
    ((deleted_count++))
done

echo -e "${GREEN}✓ Deleted $deleted_count old archive(s)${NC}"

# Show archive summary
archive_count=$(find "$ARCHIVE_DIR" -name "*.log.gz" -type f | wc -l | tr -d ' ')
archive_size=$(du -sh "$ARCHIVE_DIR" 2>/dev/null | cut -f1)

echo ""
echo -e "${BLUE}📊 Archive Summary:${NC}"
echo -e "  Files: $archive_count"
echo -e "  Size: $archive_size"
echo ""
echo -e "${GREEN}✓ Log rotation complete${NC}"
