# Video Generation with Sora 2 - Complete Guide

**Status**: ✅ Production Ready  
**Last Updated**: October 6, 2025  
**Version**: 3.0.0

---

## 📋 Quick Reference

### Command Syntax

```
/record
  prompt:"Describe your video"
  resolution:[optional - HD Landscape (1280x720) or HD Portrait (720x1280)]
  image1:[optional - reference image MUST match resolution exactly]
```

### Example

```
/record prompt:"A majestic eagle soaring through clouds at sunset" resolution:HD Landscape (1280x720)
```

### Example with Reference Image

```
/record prompt:"A corgi rolling on a red rubber ball" resolution:HD Landscape (1280x720) image1:[1280x720 image]
```

---

## 🎯 Parameters

| Parameter    | Required | Type       | Description                                                         |
| ------------ | -------- | ---------- | ------------------------------------------------------------------- |
| `prompt`     | ✅ Yes   | String     | Video description (10-1000 chars)                                   |
| `resolution` | ❌ No    | Choice     | Video size/orientation (default: 1280x720)                          |
| `image1`     | ❌ No    | Attachment | Reference image as first frame - **MUST match resolution exactly!** |

### Resolution Options

- **HD Landscape** - `1280x720` (16:9) ⭐ Default
- **HD Portrait** - `720x1280` (9:16)

> ⚠️ **Important**: If using a reference image, it must be the EXACT dimensions as your chosen resolution. A 1280x720 video requires a 1280x720 image.

---

## ⚙️ How It Works

### Generation Flow

```
1. User submits /record command
2. Bot validates parameters
3. Creates database record
4. Calls openai.videos.create() → Returns video ID
5. Polls openai.videos.retrieve() every 10 seconds
   - Status: "queued" → Keep waiting
   - Status: "processing" → Keep waiting
   - Status: "completed" → Go to step 6
   - Status: "failed" → Show error
6. Calls openai.videos.downloadContent() → Get video Buffer
7. Creates Discord AttachmentBuilder
8. Sends followUp with video (plays inline!)
```

### Typical Timeline

- **Queue time**: 0-10 minutes
- **Processing time**: 15-30 minutes
- **Total**: Usually 15-30 minutes
- **Timeout**: 30 minutes max

---

## 🎨 Using Reference Images

Reference images are used as the **first frame** of your video. The API will animate from this starting point based on your prompt.

### Critical Requirements

⚠️ **Image dimensions MUST exactly match video resolution**

- 1280x720 video → 1280x720 image
- 720x1280 video → 720x1280 image
- Mismatched dimensions will cause "Inpaint image must match the requested width and height" error

### Best Practices

✅ Use high-quality images (JPEG, PNG, WebP)  
✅ Only 1 image supported (API limitation)  
✅ Ensure exact dimension match  
✅ Describe the desired animation in your prompt

### Example Usage

**Animate from Static Image:**

```
Prompt: "She turns around and smiles, then slowly walks out of the frame"
Image1: [1280x720 photo of person facing sunset]
Resolution: HD Landscape (1280x720)
```

**Bring Scene to Life:**

```
Prompt: "Clouds rolling over mountains, birds flying across the sky"
Image1: [1280x720 landscape photo]
Resolution: HD Landscape (1280x720)
```

**Character Animation:**

```
Prompt: "The corgi starts rolling on the ball, wagging its tail"
Image1: [1280x720 corgi with red ball]
Resolution: HD Landscape (1280x720)
```

---

## 🐛 Troubleshooting

### Video Stuck in "Queued"

**Cause**: High demand on OpenAI servers  
**Solution**: Wait - it will process eventually (up to 30 min)

### "Invalid URL: null" Error

**Cause**: Old code trying to download from URL  
**Status**: ✅ Fixed - now uses `downloadContent()` method

### Video Too Large for Discord

**Cause**: Discord limit is 25 MB (most servers)  
**Solution**: Bot shows file size and OpenAI video ID to download manually

### "Inpaint image must match the requested width and height"

**Cause**: Reference image dimensions don't match video resolution  
**Solution**: Resize your image to exactly match the video resolution (e.g., 1280x720 for HD Landscape)  
**Status**: ✅ Bot now validates dimensions before sending to API

### Timeout After 30 Minutes

**Cause**: Complex prompt or high server load  
**Solution**: Try simpler prompt or lower resolution

### Network Connectivity Issues

**Cause**: Internet connection dropped or `api.openai.com` unreachable  
**Behavior**: Bot retries with exponential backoff up to 5 consecutive errors  
**Solution**:

- Bot will show orange warning if network fails
- Video may still complete successfully on OpenAI's side
- Check OpenAI dashboard with the video ID provided
- Your internet connection needs to be stable for the full 15-30 minutes

---

## 🔧 Technical Implementation

### API Endpoints Used

```javascript
// 1. Start generation
const response = await openai.videos.create({
  model: "sora-2",
  prompt: "user prompt",
  size: "1280x720",
  // input_image: base64Data (experimental)
});

// 2. Check status
const status = await openai.videos.retrieve(videoId);
// Returns: { status: "queued" | "processing" | "completed" | "failed" }

// 3. Download video
const videoBuffer = await openai.videos.downloadContent(videoId);
// Returns: Buffer with video binary data
```

### Key Files

- **`/src/commands/fun/record.js`** - Command definition and UI
- **`/src/services/soraVideoService.js`** - OpenAI API integration
- **`/supabase/supabase.js`** - Database operations

### Database Schema

```sql
videos (
  id UUID,
  user_id TEXT,
  prompt TEXT,
  reference_images TEXT[],
  openai_video_id TEXT,
  status TEXT, -- pending | processing | completed | failed
  video_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## 🚨 Known Limitations

### OpenAI API Constraints

- ❌ No duration control (model decides length, usually 4 seconds)
- ❌ No style parameter (must describe in prompt)
- ❌ No audio/music parameters yet
- ✅ Reference images supported via `input_reference` parameter
- ⚠️ Reference image MUST match video resolution exactly
- ⚠️ Only 1 reference image supported
- ⏱️ Generation is SLOW (15-30+ minutes)
- 📅 Videos expire after 24 hours

### Discord Constraints

- 📦 25 MB file size limit (most servers)
- 📦 100 MB limit (boosted servers)
- 🎬 Videos appear as attachments above embeds (Discord limitation)
- ❌ Videos cannot be embedded inside embeds (only images can)

### Parameters NOT Supported

These were tried but rejected by API:

- `duration` - Video length determined by model (~4 seconds)
- `style` - Must be described in prompt text
- `aspect_ratio` - Use `size` parameter instead
- `input_image` / `input_images` - Wrong parameter name (use `input_reference` instead)

---

## 📊 API Response Examples

### Status Response (retrieve)

```json
{
  "id": "video_68e46569fff88198be55e84d6d8b573b0788d77261272a99",
  "object": "video",
  "status": "completed",
  "created_at": 1759798634,
  "completed_at": 1759798707,
  "expires_at": 1759885107,
  "model": "sora-2",
  "progress": 100,
  "seconds": "4",
  "size": "1280x720",
  "error": null
}
```

**Note**: No URL in response! Must call `downloadContent()` separately.

### Download Response (downloadContent)

Returns a `Response` object with:

- Binary video data in body
- Content-Type: video/mp4
- Convert to Buffer for Discord attachment

---

## 💡 Tips for Better Results

### Write Descriptive Prompts

❌ "A dog"  
✅ "A golden retriever puppy playing with a red ball in a sunny park with green grass"

### Include Motion Details

❌ "A mountain"  
✅ "Mountain landscape with clouds rolling over peaks, camera slowly panning right"

### Specify Timing

✅ "A 5-second time-lapse of a flower blooming from bud to full bloom"

### Camera Movement

✅ "Drone shot rising from street level to reveal city skyline at dusk"

### Lighting & Style

✅ "Cinematic sunset with warm golden hour lighting and lens flare"

---

## 🔄 Version History

### v3.0.0 (Oct 6, 2025) - Reference Images & Fixes

- ✅ Fully implemented reference image support via `input_reference` parameter
- ✅ Added image dimension validation (must match video resolution exactly)
- ✅ Fixed DNS issues causing connection failures
- ✅ Removed widescreen resolutions (only HD options remain)
- ✅ Fixed video display text ("above" not "below")
- ✅ Removed redundant `recordWithImages` command
- ✅ Fixed `ready` → `clientReady` deprecation warning
- ✅ Removed deprecated `aws-sdk` v2 causing `punycode` warnings
- ✅ Suppressed unavoidable deprecation warnings from dependencies
- ✅ Uses `sharp` library for image dimension detection
- ✅ Uses OpenAI's `toFile` helper for proper file upload

### v2.1.0 (Oct 6, 2025) - Video Retrieval Fix

- ✅ Fixed "Invalid URL: null" error
- ✅ Implemented `downloadContent()` method
- ✅ Videos now play as Discord attachments

### v2.0.0 (Oct 6, 2025) - Major Enhancements

- ✅ Extended polling timeout (10min → 30min)
- ✅ Proper handling of "queued" and "processing" states
- ✅ Network error handling with exponential backoff
- ✅ Better error messages

### v1.0.0 (Oct 6, 2025) - Initial Release

- ✅ Basic text-to-video generation
- ✅ Multiple resolution options
- ✅ Database tracking
- ✅ Fixed unsupported API parameters

---

## 🎓 Common Issues & Fixes

### Issue: `openai.videos.content is not a function`

**Fix**: Changed to `openai.videos.downloadContent()` ✅

### Issue: Video stuck in "queued" for 10+ minutes

**Fix**: Extended timeout to 30 minutes ✅

### Issue: `Unknown parameter: 'duration'`

**Fix**: Removed unsupported parameters ✅

### Issue: Reference images not working / dimension mismatch

**Fix**: Image must be EXACT dimensions as video resolution. Bot validates before API call. ✅

---

## 📞 Support

### Getting Help

1. Check this documentation first
2. Look at error message in bot response
3. Check OpenAI dashboard with video ID
4. Contact bot administrator for API issues

### Useful Commands

- `/record` - Generate video
- Check database for video history
- Use OpenAI video ID to track on platform.openai.com

---

## 🔮 Future Enhancements

### Planned Features

- [ ] `/myvideos` - View generation history
- [ ] `/cancel-video` - Cancel in-progress generation
- [ ] Video caching in Supabase storage
- [ ] Compression for Discord size limits
- [ ] Progress percentage display
- [ ] Queue position indicator

### API-Dependent (Waiting for OpenAI)

- [ ] Duration control parameter
- [ ] Style presets
- [ ] Audio/music parameters
- [ ] More than 3 reference images
- [ ] Video editing (extend/trim/remix)

---

## 📝 Code Examples

### Basic Generation

```javascript
const result = await generateVideo(
  "A sunset over the ocean",
  [], // no reference images
  { resolution: "1280x720" }
);
```

### With Reference Images

```javascript
const result = await generateVideo(
  "Animate this scene with cinematic lighting",
  ["https://example.com/image1.jpg"],
  { resolution: "1920x1080" }
);
```

### Retrieve Completed Video

```javascript
const status = await checkVideoStatus(videoId);
if (status.status === "completed") {
  const buffer = await retrieveVideoContent(videoId);
  // buffer is ready for Discord attachment
}
```

---

**Quick Links:**

- [OpenAI Video Generation Docs](https://platform.openai.com/docs/guides/video-generation)
- [Discord.js Docs](https://discord.js.org/)
- Project: `/Users/coltonsteinbeck/dev/bepo`

**For updates to this documentation, edit:** `/Users/coltonsteinbeck/dev/bepo/docs/VIDEO_GENERATION.md`
