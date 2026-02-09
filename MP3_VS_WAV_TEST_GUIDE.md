# MP3 vs WAV Download Test Guide

## What Changed

I've added **two download options** to help identify if MP3 encoding is causing the quality difference:

### Download Buttons:
1. **MP3** - Compressed (128kbps) - Smaller file (~3-4MB)
2. **WAV** - Uncompressed (16-bit PCM) - Larger file (~40-50MB)

## Why This Matters

Your logs show the rendering is working perfectly:
- ✅ Settings are applied correctly (travelSpeed: 100, effectIntensity: 100, travelWidth: 100)
- ✅ Rendering completes in ~1 second
- ✅ MP3 encoding takes ~15 seconds

**The issue is likely MP3 compression affecting spatial quality.**

## MP3 Compression Impact on Spatial Audio

MP3 uses **lossy compression** which can affect:
- **Stereo imaging** - Reduces separation between left/right channels
- **High frequencies** - Removes subtle spatial cues
- **Phase relationships** - Critical for 8D/spatial effects
- **Transients** - Fast panning movements may blur

At 128kbps, MP3 compression can reduce the perceived "width" and "movement" of spatial audio.

## Testing Instructions

### Test 1: Compare MP3 vs WAV
1. **Play audio on website** - Note how it sounds
2. **Download as WAV** (larger file, ~40-50MB)
3. **Play WAV file** - Does it match website playback?
4. **Download as MP3** (smaller file, ~3-4MB)
5. **Play MP3 file** - Compare to WAV

### Expected Results:

**If WAV matches website but MP3 doesn't:**
- ✅ Rendering is correct
- ❌ MP3 compression is the problem
- **Solution:** Use higher bitrate MP3 (192kbps or 320kbps) or stick with WAV

**If both WAV and MP3 don't match website:**
- ❌ Rendering has a bug
- **Solution:** Need to investigate the offline rendering vs real-time engine difference

## File Size Comparison

For a 3-minute song:
- **Original MP3**: ~3-4 MB
- **Rendered WAV**: ~40-50 MB (uncompressed)
- **Rendered MP3 (128kbps)**: ~3-4 MB (compressed)
- **Rendered MP3 (320kbps)**: ~7-8 MB (higher quality)

## Next Steps Based on Results

### Scenario A: WAV sounds perfect, MP3 doesn't
**Problem:** MP3 compression is too aggressive for spatial audio

**Solutions:**
1. Increase MP3 bitrate to 192kbps or 320kbps
2. Use VBR (Variable Bit Rate) encoding
3. Recommend WAV for best quality
4. Add quality selector (Low/Medium/High)

### Scenario B: Both WAV and MP3 sound wrong
**Problem:** Offline rendering differs from real-time playback

**Possible causes:**
1. Settings not applied correctly (but logs show they are)
2. Different audio graph structure
3. Timing/automation differences
4. Sample rate conversion issues

**Solutions:**
1. Capture real-time engine output directly
2. Add A/B comparison tool
3. Verify automation curves match

### Scenario C: Both sound perfect
**Problem:** User perception or playback environment

**Check:**
1. Playback device (headphones vs speakers)
2. Media player (some compress audio)
3. System audio enhancements (disable)
4. Volume normalization (disable)

## Technical Details

### Current MP3 Settings:
```javascript
bitrate: 128kbps
sampleRate: 48000 Hz (matches source)
channels: 2 (stereo)
encoding: CBR (Constant Bit Rate)
```

### WAV Settings:
```javascript
format: 16-bit PCM
sampleRate: 48000 Hz (matches source)
channels: 2 (stereo)
compression: None (lossless)
```

## Logs to Check

When testing, check console for:

```
[Download] Starting download process (MP3)...
[ExportMP3] MP3 file size: 3.34 MB
[ExportMP3] Total export time: 15693ms
```

vs

```
[Download] Starting download process (WAV)...
[ExportWAV] WAV file size: 42.15 MB
[ExportWAV] Total export time: 164ms
```

Note: WAV export is **much faster** (no encoding needed)

## Recommendations

1. **Test with WAV first** - This is the "ground truth"
2. **Use good headphones** - Spatial effects need stereo separation
3. **Disable audio enhancements** - System EQ can affect spatial perception
4. **Compare same section** - Listen to the same 10-second clip on website vs file

## If You Need Higher Quality MP3

Let me know if WAV sounds good but MP3 doesn't, and I can:
1. Increase bitrate to 192kbps or 320kbps
2. Implement VBR encoding for better quality
3. Add a quality selector in the UI

The trade-off is file size:
- 128kbps: ~3-4 MB (current)
- 192kbps: ~5-6 MB (better)
- 320kbps: ~7-8 MB (best MP3 quality)
- WAV: ~40-50 MB (lossless)
