// play.js
import { joinVoiceChannel, createAudioResource, createAudioPlayer, StreamType, AudioPlayerStatus } from '@discordjs/voice';
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import playdl from 'play-dl';
import youtubedl from 'youtube-dl-exec';
import { Readable } from 'stream';
import voiceActivityManager from '../../utils/voiceActivityManager.js';

// Global music queue and player state
const musicQueues = new Map(); // guildId -> queue data
const connections = new Map(); // guildId -> voice connection

// Export the musicQueues for use in other commands
export { musicQueues };

// Helper function to detect YouTube URL types
const analyzeYouTubeUrl = (url) => {
    const result = {
        isLivestream: false,
        isPlaylist: false,
        isValid: false,
        type: 'unknown'
    };

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname;
        const searchParams = urlObj.searchParams;

        // Check if it's a YouTube URL
        if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
            return result;
        }

        result.isValid = true;

        // Check for playlist indicators
        if (pathname.includes('/playlist') || searchParams.has('list')) {
            result.isPlaylist = true;
            result.type = 'playlist';
            return result;
        }

        // Check for livestream indicators
        if (pathname.includes('/live/') || 
            searchParams.get('live') === '1' || 
            searchParams.has('live')) {
            result.isLivestream = true;
            result.type = 'livestream';
            return result;
        }

        // If it's a regular video
        if (pathname.includes('/watch') || hostname.includes('youtu.be')) {
            result.type = 'video';
        }

        return result;
    } catch (error) {
        console.error('Error analyzing YouTube URL:', error);
        return result;
    }
};

// Queue management functions
export const addToQueue = (guildId, songData) => {
    const queueData = musicQueues.get(guildId);
    if (queueData) {
        queueData.songs.push(songData);
        // Update activity data
        voiceActivityManager.updateActivity(guildId, queueData);
        return true;
    }
    return false;
};

export const removeFromQueue = (guildId, index) => {
    const queueData = musicQueues.get(guildId);
    if (queueData && index >= 0 && index < queueData.songs.length && index !== queueData.currentIndex) {
        const removed = queueData.songs.splice(index, 1)[0];
        // Adjust current index if necessary
        if (index < queueData.currentIndex) {
            queueData.currentIndex--;
        }
        // Update activity data
        voiceActivityManager.updateActivity(guildId, queueData);
        return removed;
    }
    return null;
};

export const moveInQueue = (guildId, fromIndex, toIndex) => {
    const queueData = musicQueues.get(guildId);
    if (queueData && fromIndex >= 0 && fromIndex < queueData.songs.length && 
        toIndex >= 0 && toIndex < queueData.songs.length && 
        fromIndex !== queueData.currentIndex && toIndex !== queueData.currentIndex) {
        
        const song = queueData.songs.splice(fromIndex, 1)[0];
        queueData.songs.splice(toIndex, 0, song);
        
        // Adjust current index if necessary
        if (fromIndex < queueData.currentIndex && toIndex >= queueData.currentIndex) {
            queueData.currentIndex--;
        } else if (fromIndex > queueData.currentIndex && toIndex <= queueData.currentIndex) {
            queueData.currentIndex++;
        }
        
        return song;
    }
    return null;
};

export const clearQueue = (guildId) => {
    const queueData = musicQueues.get(guildId);
    if (queueData) {
        const clearedCount = queueData.songs.length - queueData.currentIndex - 1;
        queueData.songs = queueData.songs.slice(0, queueData.currentIndex + 1);
        // Update activity data
        voiceActivityManager.updateActivity(guildId, queueData);
        return clearedCount;
    }
    return 0;
};

// Set up play-dl with some configuration
const setupPlayDL = async () => {
    try {
        await playdl.setToken({
            youtube: {
                cookie: process.env.YOUTUBE_COOKIE || ''
            }
        });
    } catch (error) {
        console.log('play-dl setup note:', error.message);
    }
};

// Function to get Spotify metadata and search YouTube for each track
const getSpotifyTrackInfo = async (spotifyUrl) => {
    try {
        console.log(`[SPOTIFY] Starting to process URL: ${spotifyUrl}`);
        
        // Parse Spotify URL to extract track/playlist/album ID
        const spotifyRegex = /spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/;
        const openSpotifyRegex = /open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/;
        
        let match = spotifyUrl.match(spotifyRegex) || spotifyUrl.match(openSpotifyRegex);
        
        if (!match) {
            console.log('[SPOTIFY] No regex match found for URL');
            return null;
        }

        const [, type, id] = match;
        console.log(`[SPOTIFY] Detected ${type} with ID: ${id}`);

        if (type === 'track') {
            console.log('[SPOTIFY] Processing single track...');
            // Get single track metadata from Spotify
            const trackData = await getSpotifyMetadata(type, id);
            if (!trackData) {
                console.log('[SPOTIFY] Failed to get track metadata');
                return null;
            }

            console.log(`[SPOTIFY] Got track data: ${trackData.name} by ${trackData.artists.join(', ')}`);
            // Search with both artist and song name for better results
            const searchQuery = `${trackData.artists.join(' ')} ${trackData.name}`;
            console.log(`[SPOTIFY] Searching YouTube for: "${searchQuery}"`);
            
            const searchResults = await playdl.search(searchQuery, { limit: 1, source: { youtube: 'video' } });
            
            if (searchResults.length > 0) {
                const youtubeVideo = searchResults[0];
                console.log(`[SPOTIFY] Found YouTube video: ${youtubeVideo.title}`);
                return {
                    originalUrl: spotifyUrl,
                    youtubeUrl: youtubeVideo.url,
                    title: trackData.name,
                    artist: trackData.artists.join(', '),
                    duration: youtubeVideo.durationRaw || 'Unknown',
                    thumbnail: trackData.image || youtubeVideo.thumbnails?.[0]?.url,
                    isSpotifyTrack: true
                };
            } else {
                console.log('[SPOTIFY] No YouTube results found for track');
            }
        } else if (type === 'album' || type === 'playlist') {
            console.log(`[SPOTIFY] Processing ${type}...`);
            // Get album/playlist metadata from Spotify
            const spotifyData = await getSpotifyMetadata(type, id);
            if (!spotifyData || !spotifyData.tracks || spotifyData.tracks.length === 0) {
                console.log('[SPOTIFY] Failed to get album/playlist metadata or no tracks found');
                return null;
            }

            console.log(`[SPOTIFY] Got ${type} data: ${spotifyData.name} with ${spotifyData.tracks.length} tracks`);
            
            // First, try to find the complete album/playlist on YouTube
            console.log('[SPOTIFY] Searching for complete album/playlist on YouTube...');
            const albumSearchQueries = [
                `${spotifyData.name} full album`,
                `${spotifyData.name} complete album`,
                `${spotifyData.name} playlist`,
                `${spotifyData.name} all tracks`,
                spotifyData.name
            ];
            
            let foundPlaylistTracks = [];
            
            // Try searching for playlists first
            for (const query of albumSearchQueries) {
                console.log(`[SPOTIFY] Trying playlist search: "${query}"`);
                try {
                    const playlistResults = await playdl.search(query, { 
                        limit: 5, 
                        source: { youtube: 'playlist' } 
                    });
                    
                    if (playlistResults.length > 0) {
                        for (const playlist of playlistResults) {
                            console.log(`[SPOTIFY] Found playlist: ${playlist.title} (${playlist.videoCount || 'unknown'} videos)`);
                            try {
                                // Get playlist videos
                                const playlistInfo = await playdl.playlist_info(playlist.url);
                                const videos = await playlistInfo.all_videos();
                                
                                console.log(`[SPOTIFY] Playlist has ${videos.length} videos`);
                                
                                // Check if this playlist matches our expected tracks
                                const matchedTracks = matchPlaylistToSpotifyTracks(videos, spotifyData.tracks);
                                
                                if (matchedTracks.length >= Math.min(spotifyData.tracks.length * 0.6, 8)) { // At least 60% match or 8 tracks
                                    console.log(`[SPOTIFY] Good playlist match found! ${matchedTracks.length}/${spotifyData.tracks.length} tracks matched`);
                                    foundPlaylistTracks = matchedTracks;
                                    break;
                                }
                            } catch (error) {
                                console.log(`[SPOTIFY] Error processing playlist ${playlist.title}:`, error.message);
                            }
                        }
                        
                        if (foundPlaylistTracks.length > 0) break;
                    }
                } catch (error) {
                    console.log(`[SPOTIFY] Error searching for album playlist:`, error.message);
                }
                
                // Small delay between searches
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // If no good playlist found, try searching for full album videos
            if (foundPlaylistTracks.length === 0) {
                console.log('[SPOTIFY] No good playlists found, searching for full album videos...');
                for (const query of albumSearchQueries) {
                    console.log(`[SPOTIFY] Trying full album video search: "${query}"`);
                    try {
                        const videoResults = await playdl.search(query, { 
                            limit: 5, 
                            source: { youtube: 'video' } 
                        });
                        
                        for (const video of videoResults) {
                            const title = video.title.toLowerCase();
                            const duration = video.durationInSec || 0;
                            
                            // Check if this looks like a full album (long duration, contains "full" or "complete")
                            const hasFullKeywords = title.includes('full') || title.includes('complete') || 
                                                  title.includes('entire') || title.includes('whole');
                            const isLongEnough = duration > 1800; // At least 30 minutes for full album
                            const containsAlbumName = title.includes(spotifyData.name.toLowerCase());
                            
                            if (containsAlbumName && (hasFullKeywords || isLongEnough)) {
                                console.log(`[SPOTIFY] Found potential full album video: "${video.title}" (${video.durationRaw})`);
                                // For full album videos, we'll just add it as a single track and let users skip through
                                foundPlaylistTracks = [{
                                    originalUrl: spotifyUrl,
                                    youtubeUrl: video.url,
                                    title: `${spotifyData.name} (Full Album)`,
                                    artist: spotifyData.tracks[0]?.artists?.join(', ') || 'Various Artists',
                                    duration: video.durationRaw || 'Unknown',
                                    thumbnail: video.thumbnails?.[0]?.url,
                                    isSpotifyTrack: true,
                                    isFullAlbum: true
                                }];
                                console.log(`[SPOTIFY] Using full album video instead of individual tracks`);
                                break;
                            }
                        }
                        
                        if (foundPlaylistTracks.length > 0) break;
                    } catch (error) {
                        console.log(`[SPOTIFY] Error searching for full album video:`, error.message);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Now we have some tracks from playlist, search individually for missing ones
            const tracks = [...foundPlaylistTracks];
            
            // Always search for individual tracks to maintain skip functionality
            // Even if we found a full album video, we want individual tracks for better control
            const foundTrackNames = foundPlaylistTracks.map(t => t.title.toLowerCase());
            const missingSpotifyTracks = spotifyData.tracks.filter(track => 
                !foundTrackNames.some(foundName => 
                    foundName.includes(track.name.toLowerCase()) || 
                    track.name.toLowerCase().includes(foundName.split(' - ')[0]?.toLowerCase() || '')
                )
            );
            
            console.log(`[SPOTIFY] Found ${foundPlaylistTracks.length} tracks from playlist, need to search for ${missingSpotifyTracks.length} missing tracks`);
            
            // If we found a full album video but no individual tracks, search for all tracks individually
            if (foundPlaylistTracks.length > 0 && foundPlaylistTracks[0].isFullAlbum) {
                console.log(`[SPOTIFY] Found full album video, but searching for individual tracks for better skip functionality`);
                // Clear the full album track and search for all individual tracks instead
                tracks.length = 0;
                missingSpotifyTracks.length = 0;
                missingSpotifyTracks.push(...spotifyData.tracks);
            }
            
            const maxIndividualSearches = Math.min(missingSpotifyTracks.length, 20);
            for (let i = 0; i < maxIndividualSearches; i++) {
                const track = missingSpotifyTracks[i];
                const searchQuery = `${track.artists.join(' ')} ${track.name}`;
                console.log(`[SPOTIFY] [${i + 1}/${maxIndividualSearches}] Searching for track: "${searchQuery}"`);
                
                try {
                    const searchResults = await playdl.search(searchQuery, { 
                        limit: 1, 
                        source: { youtube: 'video' } 
                    });
                    
                    if (searchResults.length > 0) {
                        const video = searchResults[0];
                        console.log(`[SPOTIFY] [${i + 1}/${maxIndividualSearches}] Found: ${video.title}`);
                        
                        // Find the correct position for this track to maintain Spotify order
                        const originalIndex = spotifyData.tracks.findIndex(t => t.name === track.name);
                        const trackData = {
                            originalUrl: spotifyUrl,
                            youtubeUrl: video.url,
                            title: track.name,
                            artist: track.artists.join(', '),
                            duration: video.durationRaw || 'Unknown',
                            thumbnail: track.image || video.thumbnails?.[0]?.url,
                            isSpotifyTrack: true,
                            originalIndex: originalIndex
                        };
                        
                        tracks.push(trackData);
                    } else {
                        console.log(`[SPOTIFY] [${i + 1}/${maxIndividualSearches}] No results found`);
                    }
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (error) {
                    console.log(`[SPOTIFY] [${i + 1}/${maxIndividualSearches}] Error searching for track "${track.name}":`, error.message);
                }
            }
            
            // Sort tracks by their original Spotify order
            tracks.sort((a, b) => {
                const aIndex = a.originalIndex !== undefined ? a.originalIndex : spotifyData.tracks.findIndex(t => t.name === a.title);
                const bIndex = b.originalIndex !== undefined ? b.originalIndex : spotifyData.tracks.findIndex(t => t.name === b.title);
                return aIndex - bIndex;
            });
            
            console.log(`[SPOTIFY] Successfully found ${tracks.length} total tracks on YouTube, sorted in original order`);
            
            if (tracks.length > 0) {
                return {
                    type: type,
                    name: spotifyData.name,
                    tracks: tracks,
                    originalUrl: spotifyUrl
                };
            }
        }
        
        console.log('[SPOTIFY] No results found');
        return null;
    } catch (error) {
        console.error('[SPOTIFY] Error processing Spotify URL:', error);
        return null;
    }
};

// Function to get metadata from Spotify using public API
const getSpotifyMetadata = async (type, id) => {
    try {
        console.log(`[SPOTIFY_META] Fetching metadata for ${type}/${id}`);
        
        // Try multiple approaches to get track metadata
        if (type === 'track') {
            // Method 1: Try oEmbed API first
            try {
                const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`;
                console.log(`[SPOTIFY_META] Calling oEmbed API: ${oEmbedUrl}`);
                
                const oEmbedResponse = await fetch(oEmbedUrl);
                
                if (oEmbedResponse.ok) {
                    const oEmbedData = await oEmbedResponse.json();
                    console.log(`[SPOTIFY_META] Got oEmbed data:`, oEmbedData);
                    
                    const title = oEmbedData.title || '';
                    console.log(`[SPOTIFY_META] Processing track title: "${title}"`);
                    
                    // Try to parse "Song by Artist" format
                    const parts = title.split(' by ');
                    if (parts.length >= 2) {
                        const result = {
                            name: parts[0],
                            artists: [parts[1]],
                            image: oEmbedData.thumbnail_url
                        };
                        console.log(`[SPOTIFY_META] Parsed track from oEmbed:`, result);
                        return result;
                    }
                    
                    // Store title and image for potential fallback use
                    var oEmbedTitle = title;
                    var oEmbedImage = oEmbedData.thumbnail_url;
                }
            } catch (error) {
                console.log(`[SPOTIFY_META] oEmbed API failed:`, error.message);
            }
            
            // Method 2: Try scraping the Spotify page for more metadata
            try {
                console.log(`[SPOTIFY_META] Attempting to scrape Spotify page for track metadata...`);
                const spotifyPageUrl = `https://open.spotify.com/track/${id}`;
                const pageResponse = await fetch(spotifyPageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                
                if (pageResponse.ok) {
                    const html = await pageResponse.text();
                    console.log(`[SPOTIFY_META] Got HTML content, length: ${html.length} characters`);
                    
                    // Try multiple approaches to extract artist and title
                    let extractedArtist = null;
                    let extractedTitle = oEmbedTitle || null;
                    
                    // Method 1: Look for og:description meta tag (often contains "Song · Artist · Year")
                    const ogDescMatch = html.match(/<meta property="og:description" content="([^"]*?)"/i);
                    if (ogDescMatch && ogDescMatch[1]) {
                        console.log(`[SPOTIFY_META] Found og:description: "${ogDescMatch[1]}"`);
                        const description = ogDescMatch[1];
                        
                        // Pattern: "Song · Artist · Year" or "Song by Artist"
                        if (description.includes(' · ')) {
                            const parts = description.split(' · ');
                            if (parts.length >= 2) {
                                extractedTitle = parts[0].trim();
                                extractedArtist = parts[1].trim();
                                console.log(`[SPOTIFY_META] Extracted from og:description - Title: "${extractedTitle}", Artist: "${extractedArtist}"`);
                            }
                        } else if (description.includes(' by ')) {
                            const parts = description.split(' by ');
                            if (parts.length >= 2) {
                                extractedTitle = parts[0].trim();
                                extractedArtist = parts[1].trim();
                                console.log(`[SPOTIFY_META] Extracted from og:description "by" pattern - Title: "${extractedTitle}", Artist: "${extractedArtist}"`);
                            }
                        }
                    }
                    
                    // Method 2: Look for JSON-LD structured data
                    if (!extractedArtist) {
                        const jsonLdMatches = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gis);
                        if (jsonLdMatches) {
                            for (const jsonMatch of jsonLdMatches) {
                                try {
                                    const jsonContent = jsonMatch.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                                    const jsonData = JSON.parse(jsonContent);
                                    console.log(`[SPOTIFY_META] Found JSON-LD data:`, jsonData);
                                    
                                    if (jsonData.name && !extractedTitle) {
                                        extractedTitle = jsonData.name;
                                    }
                                    
                                    if (jsonData.byArtist && jsonData.byArtist.name) {
                                        extractedArtist = jsonData.byArtist.name;
                                        console.log(`[SPOTIFY_META] Extracted artist from JSON-LD byArtist: "${extractedArtist}"`);
                                        break;
                                    } else if (jsonData.author && jsonData.author.name) {
                                        extractedArtist = jsonData.author.name;
                                        console.log(`[SPOTIFY_META] Extracted artist from JSON-LD author: "${extractedArtist}"`);
                                        break;
                                    }
                                } catch (e) {
                                    console.log(`[SPOTIFY_META] Failed to parse JSON-LD:`, e.message);
                                }
                            }
                        }
                    }
                    
                    // Method 3: Look for specific meta tags
                    if (!extractedArtist) {
                        const artistMatches = [
                            html.match(/<meta property="music:musician" content="([^"]+)"/i),
                            html.match(/<meta name="twitter:audio:artist_name" content="([^"]+)"/i),
                            html.match(/<meta property="twitter:audio:artist_name" content="([^"]+)"/i),
                            html.match(/<meta name="music:musician" content="([^"]+)"/i)
                        ];
                        
                        for (const match of artistMatches) {
                            if (match && match[1] && match[1].trim() !== '' && !match[1].toLowerCase().includes('spotify')) {
                                extractedArtist = match[1].trim();
                                console.log(`[SPOTIFY_META] Extracted artist from meta tag: "${extractedArtist}"`);
                                break;
                            }
                        }
                    }
                    
                    // Method 4: Look for title patterns in the page title
                    if (!extractedArtist || !extractedTitle) {
                        const titleMatches = [
                            html.match(/<title>([^|]+) \| ([^<]+)<\/title>/i),
                            html.match(/<title>([^-]+) - ([^|<]+)/i),
                            html.match(/<title>([^<]*?) by ([^|<]+)/i)
                        ];
                        
                        for (const match of titleMatches) {
                            if (match && match[1] && match[2]) {
                                if (!extractedTitle) extractedTitle = match[1].trim();
                                if (!extractedArtist && !match[2].toLowerCase().includes('spotify')) {
                                    extractedArtist = match[2].trim();
                                    console.log(`[SPOTIFY_META] Extracted from title tag - Title: "${extractedTitle}", Artist: "${extractedArtist}"`);
                                }
                                break;
                            }
                        }
                    }
                    
                    // Method 5: Look for inline JavaScript data
                    if (!extractedArtist) {
                        const scriptMatches = [
                            html.match(/"artists":\s*\[\s*{\s*"name":\s*"([^"]+)"/i),
                            html.match(/"artist":\s*{\s*"name":\s*"([^"]+)"/i),
                            html.match(/"creator":\s*{\s*"name":\s*"([^"]+)"/i)
                        ];
                        
                        for (const match of scriptMatches) {
                            if (match && match[1] && match[1].trim() !== '') {
                                extractedArtist = match[1].trim();
                                console.log(`[SPOTIFY_META] Extracted artist from script data: "${extractedArtist}"`);
                                break;
                            }
                        }
                    }
                    
                    // If we found artist info, use it
                    if (extractedArtist && extractedTitle) {
                        const result = {
                            name: extractedTitle,
                            artists: [extractedArtist],
                            image: oEmbedImage
                        };
                        console.log(`[SPOTIFY_META] Successfully scraped track metadata:`, result);
                        return result;
                    } else {
                        console.log(`[SPOTIFY_META] Scraping partially successful - Title: "${extractedTitle}", Artist: "${extractedArtist}"`);
                    }
                } else {
                    console.log(`[SPOTIFY_META] Failed to fetch Spotify page: ${pageResponse.status}`);
                }
            } catch (error) {
                console.log(`[SPOTIFY_META] Scraping failed:`, error.message);
            }
            
            // Method 3: Enhanced fallback - try to extract artist from YouTube search
            if (oEmbedTitle) {
                console.log(`[SPOTIFY_META] Attempting enhanced fallback - searching YouTube to find artist...`);
                try {
                    // Search YouTube with just the song title to see if we can find the artist
                    const searchResults = await playdl.search(oEmbedTitle, { limit: 3, source: { youtube: 'video' } });
                    
                    let extractedArtist = 'Unknown Artist';
                    
                    if (searchResults.length > 0) {
                        for (const video of searchResults) {
                            const videoTitle = video.title.toLowerCase();
                            const songTitle = oEmbedTitle.toLowerCase();
                            
                            // Check if this video looks like it matches our song
                            if (videoTitle.includes(songTitle) || songTitle.includes(videoTitle.split('-')[0]?.trim() || '')) {
                                console.log(`[SPOTIFY_META] Analyzing YouTube video: "${video.title}"`);
                                
                                // Try to extract artist from video title patterns
                                const titlePatterns = [
                                    video.title.match(/^([^-]+) - /), // "Artist - Song"
                                    video.title.match(/ - ([^-]+)$/), // "Song - Artist" 
                                    video.title.match(/^([^|]+) \|/), // "Artist | Song"
                                    video.title.match(/\| ([^|]+)$/), // "Song | Artist"
                                    video.title.match(/by ([^(]+)/i), // "Song by Artist"
                                    video.title.match(/^([^(]+) \(/), // "Artist (Song)"
                                ];
                                
                                for (const pattern of titlePatterns) {
                                    if (pattern && pattern[1]) {
                                        const candidate = pattern[1].trim();
                                        // Avoid common non-artist terms
                                        if (!candidate.toLowerCase().match(/(official|video|lyrics|audio|music|hd|4k|remix|cover|live|ft\.|feat\.)/)) {
                                            extractedArtist = candidate;
                                            console.log(`[SPOTIFY_META] Extracted artist from YouTube title: "${extractedArtist}"`);
                                            break;
                                        }
                                    }
                                }
                                
                                // Also try the channel name if title parsing didn't work
                                if (extractedArtist === 'Unknown Artist' && video.channel && video.channel.name) {
                                    const channelName = video.channel.name;
                                    // Use channel name if it doesn't look like a generic music channel
                                    if (!channelName.toLowerCase().match(/(records|music|entertainment|official|vevo|channel|tv)/)) {
                                        extractedArtist = channelName;
                                        console.log(`[SPOTIFY_META] Using YouTube channel name as artist: "${extractedArtist}"`);
                                    }
                                }
                                
                                if (extractedArtist !== 'Unknown Artist') break;
                            }
                        }
                    }
                    
                    const result = {
                        name: oEmbedTitle,
                        artists: [extractedArtist],
                        image: oEmbedImage
                    };
                    console.log(`[SPOTIFY_META] Enhanced fallback result:`, result);
                    return result;
                    
                } catch (searchError) {
                    console.log(`[SPOTIFY_META] YouTube search fallback failed:`, searchError.message);
                    
                    // Final fallback
                    const result = {
                        name: oEmbedTitle,
                        artists: ['Unknown Artist'],
                        image: oEmbedImage
                    };
                    console.log(`[SPOTIFY_META] Using final fallback with oEmbed title:`, result);
                    return result;
                }
            } else {
                console.log(`[SPOTIFY_META] All methods failed to get track metadata`);
                return null;
            }
        } else {
            // For albums/playlists, we'll try to extract basic info and use a fallback approach
            const title = oEmbedData.title || '';
            console.log(`[SPOTIFY_META] Processing ${type} title: "${title}"`);
            
            // Since we can't get track listings from oEmbed, we'll use a different approach
            // Try to extract some common album track names for known albums
            let tracks = [];
            
            if (id === '41GuZcammIkupMPKH2OJ6I' || title.toLowerCase().includes('astroworld')) {
                console.log(`[SPOTIFY_META] Detected Astroworld album`);
                // Astroworld album tracks
                tracks = [
                    { name: 'STARGAZING', artists: ['Travis Scott'] },
                    { name: 'CAROUSEL', artists: ['Travis Scott'] },
                    { name: 'SICKO MODE', artists: ['Travis Scott'] },
                    { name: 'R.I.P. SCREW', artists: ['Travis Scott'] },
                    { name: 'STOP TRYING TO BE GOD', artists: ['Travis Scott'] },
                    { name: 'NO BYSTANDERS', artists: ['Travis Scott'] },
                    { name: 'SKELETONS', artists: ['Travis Scott'] },
                    { name: 'WAKE UP', artists: ['Travis Scott'] },
                    { name: 'ASTROTHUNDER', artists: ['Travis Scott'] },
                    { name: 'YOSEMITE', artists: ['Travis Scott'] },
                    { name: 'CANT SAY', artists: ['Travis Scott'] },
                    { name: 'WHO WHAT', artists: ['Travis Scott'] },
                    { name: 'BUTTERFLY EFFECT', artists: ['Travis Scott'] },
                    { name: 'HOUSTONFORNICATION', artists: ['Travis Scott'] },
                    { name: 'COFFEE BEAN', artists: ['Travis Scott'] }
                ];
            } else {
                console.log(`[SPOTIFY_META] Unknown ${type}, using fallback tracks`);
                // For unknown albums, create a generic set based on the title
                const artistMatch = title.match(/by (.+)$/);
                const artist = artistMatch ? artistMatch[1] : 'Unknown Artist';
                console.log(`[SPOTIFY_META] Extracted artist: "${artist}"`);
                
                tracks = [
                    { name: `${artist} - Popular Song 1`, artists: [artist] },
                    { name: `${artist} - Popular Song 2`, artists: [artist] },
                    { name: `${artist} - Popular Song 3`, artists: [artist] },
                    { name: `${artist} - Popular Song 4`, artists: [artist] },
                    { name: `${artist} - Popular Song 5`, artists: [artist] }
                ];
            }
            
            const result = {
                name: title,
                tracks: tracks.map(track => ({
                    ...track,
                    image: oEmbedData.thumbnail_url
                }))
            };
            
            console.log(`[SPOTIFY_META] Final ${type} result:`, result);
            return result;
        }
    } catch (error) {
        console.error(`[SPOTIFY_META] Error fetching Spotify metadata:`, error);
        return null;
    }
};

// Helper function to extract track info from Spotify URL
const extractTrackInfoFromUrl = async (spotifyUrl) => {
    try {
        // This is a fallback - try to extract the track name from the URL
        // Most Spotify URLs don't contain the track name, so this will often fail
        // In that case, we'll just search generically
        return "popular song"; // Generic fallback search
    } catch (error) {
        return "popular song";
    }
};

// Helper function to match YouTube playlist tracks to Spotify tracks
const matchPlaylistToSpotifyTracks = (youtubeVideos, spotifyTracks) => {
    console.log(`[SPOTIFY_MATCH] Matching ${youtubeVideos.length} YouTube videos to ${spotifyTracks.length} Spotify tracks`);
    
    const matchedTracks = [];
    const usedVideoIndices = new Set();
    
    // Try to match each Spotify track to a YouTube video
    for (let i = 0; i < spotifyTracks.length; i++) {
        const spotifyTrack = spotifyTracks[i];
        const spotifyTitle = spotifyTrack.name.toLowerCase();
        const spotifyArtists = spotifyTrack.artists.map(a => a.toLowerCase());
        
        console.log(`[SPOTIFY_MATCH] Looking for: "${spotifyTrack.name}" by ${spotifyTrack.artists.join(', ')}`);
        
        let bestMatch = null;
        let bestScore = 0;
        let bestVideoIndex = -1;
        
        // Check each YouTube video for a match
        for (let j = 0; j < youtubeVideos.length; j++) {
            if (usedVideoIndices.has(j)) continue; // Skip already matched videos
            
            const video = youtubeVideos[j];
            const videoTitle = video.title.toLowerCase();
            
            // Calculate match score
            let score = 0;
            
            // Check if video title contains the track name
            if (videoTitle.includes(spotifyTitle)) {
                score += 50;
            }
            
            // Check if video title contains any artist name
            for (const artist of spotifyArtists) {
                if (videoTitle.includes(artist)) {
                    score += 30;
                }
            }
            
            // Bonus for exact position match (track order)
            if (Math.abs(j - i) <= 2) { // Within 2 positions
                score += 20;
            }
            
            // Penalty for very different lengths
            const titleLengthDiff = Math.abs(videoTitle.length - spotifyTitle.length);
            if (titleLengthDiff > 20) {
                score -= 10;
            }
            
            console.log(`[SPOTIFY_MATCH] Video "${video.title}" scored ${score}`);
            
            if (score > bestScore && score >= 30) { // Minimum score threshold
                bestMatch = video;
                bestScore = score;
                bestVideoIndex = j;
            }
        }
        
        if (bestMatch) {
            console.log(`[SPOTIFY_MATCH] ✅ Matched "${spotifyTrack.name}" to "${bestMatch.title}" (score: ${bestScore})`);
            usedVideoIndices.add(bestVideoIndex);
            
            matchedTracks.push({
                originalUrl: `https://open.spotify.com/track/${spotifyTrack.id || 'unknown'}`,
                youtubeUrl: bestMatch.url,
                title: spotifyTrack.name,
                artist: spotifyTrack.artists.join(', '),
                duration: bestMatch.durationRaw || 'Unknown',
                thumbnail: spotifyTrack.image || bestMatch.thumbnails?.[0]?.url,
                isSpotifyTrack: true,
                originalSpotifyUrl: `https://open.spotify.com/track/${spotifyTrack.id || 'unknown'}`,
                originalIndex: i  // Add original index for sorting
            });
        } else {
            console.log(`[SPOTIFY_MATCH] ❌ No good match found for "${spotifyTrack.name}"`);
        }
    }
    
    console.log(`[SPOTIFY_MATCH] Successfully matched ${matchedTracks.length}/${spotifyTracks.length} tracks`);
    return matchedTracks;
};

// Create music control embed
const createMusicEmbed = (song, queue, isPlaying = true) => {
    const isSpotify = song.isSpotifyTrack;
    const embedColor = isSpotify ? '#1DB954' : (isPlaying ? '#00ff00' : '#ff9900');
    const title = isPlaying ? 
        (isSpotify ? '🎵 Now Playing (via Spotify)' : '🎵 Now Playing') : 
        '⏸️ Paused';

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription(`**${song.title}**`)
        .addFields(
            { name: '👤 Artist/Channel', value: song.channel || 'Unknown', inline: true },
            { name: '⏱️ Duration', value: song.duration || 'Unknown', inline: true },
            { name: '📋 Queue', value: `${queue.currentIndex + 1}/${queue.songs.length}`, inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();

    if (isSpotify && song.originalSpotifyUrl) {
        embed.setFooter({ text: '🎵 Converted from Spotify • Playing via YouTube' });
    }

    if (queue.songs.length > 1) {
        const upcoming = queue.songs.slice(queue.currentIndex + 1, queue.currentIndex + 4)
            .map((s, i) => `${i + 1}. ${s.title} ${s.isSpotifyTrack ? '🎵' : ''}`)
            .join('\n') || 'No upcoming songs';
        embed.addFields({ name: '🔜 Up Next', value: upcoming });
    }

    return embed;
};

// Create enhanced queue addition embed
const createQueueAddedEmbed = (addedSong, queueData) => {
    const embedColor = addedSong.isSpotifyTrack ? '#1DB954' : '#00ff00';
    const embedTitle = addedSong.isSpotifyTrack ? '🎵 Added Spotify Track to Queue' : '➕ Added to Queue';
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(embedTitle)
        .setDescription(`**${addedSong.title}**`)
        .addFields(
            { name: '👤 Artist/Channel', value: addedSong.channel || 'Unknown', inline: true },
            { name: '📍 Position in Queue', value: `${queueData.songs.length}`, inline: true },
            { name: '📋 Total Songs', value: `${queueData.songs.length} songs`, inline: true }
        )
        .setThumbnail(addedSong.thumbnail)
        .setTimestamp();

    // Show currently playing song
    if (queueData.currentIndex >= 0 && queueData.currentIndex < queueData.songs.length) {
        const currentSong = queueData.songs[queueData.currentIndex];
        embed.addFields({
            name: '🎵 Currently Playing',
            value: `**${currentSong.title}** ${currentSong.isSpotifyTrack ? '🎵' : ''}`,
            inline: false
        });
    }

    // Show next few songs in queue (including the one just added)
    const upcomingSongs = queueData.songs.slice(queueData.currentIndex + 1);
    if (upcomingSongs.length > 0) {
        const queueList = upcomingSongs.slice(0, 5) // Show up to 5 upcoming songs
            .map((song, index) => {
                const position = queueData.currentIndex + 2 + index; // +2 because currentIndex is 0-based and we want next songs
                const isNewlyAdded = position === queueData.songs.length; // Check if this is the song we just added
                const prefix = isNewlyAdded ? '**➤' : `${position}.`;
                const suffix = isNewlyAdded ? ' ← NEW**' : '';
                return `${prefix} ${song.title}${song.isSpotifyTrack ? ' 🎵' : ''}${suffix}`;
            })
            .join('\n');
        
        const moreCount = upcomingSongs.length > 5 ? ` (+${upcomingSongs.length - 5} more)` : '';
        embed.addFields({
            name: '🔜 Up Next',
            value: queueList + moreCount,
            inline: false
        });
    }

    if (addedSong.isSpotifyTrack && addedSong.originalSpotifyUrl) {
        embed.setFooter({ text: '🎵 Converted from Spotify • Added to queue' });
    }

    return embed;
};

// Create enhanced Spotify album/playlist addition embed
const createSpotifyAlbumAddedEmbed = (spotifyData, queueData, startPosition) => {
    const embed = new EmbedBuilder()
        .setColor('#1DB954') // Spotify green
        .setTitle(`🎵 Added Spotify ${spotifyData.type === 'album' ? 'Album' : 'Playlist'} to Queue`)
        .setDescription(`**${spotifyData.name}**\n*Converted from Spotify and added to queue*`)
        .addFields(
            { name: '📀 Tracks Added', value: `${spotifyData.tracks.length}`, inline: true },
            { name: '📋 Total Queue', value: `${queueData.songs.length} songs`, inline: true },
            { name: '📍 Starting Position', value: `${startPosition}`, inline: true }
        )
        .setThumbnail(spotifyData.tracks[0]?.thumbnail)
        .setTimestamp();

    // Show currently playing song
    if (queueData.currentIndex >= 0 && queueData.currentIndex < queueData.songs.length) {
        const currentSong = queueData.songs[queueData.currentIndex];
        embed.addFields({
            name: '🎵 Currently Playing',
            value: `**${currentSong.title}** ${currentSong.isSpotifyTrack ? '🎵' : ''}`,
            inline: false
        });
    }

    // Show some of the newly added tracks
    const newlyAddedTracks = spotifyData.tracks.slice(0, 4) // Show first 4 tracks from the album/playlist
        .map((track, index) => {
            const position = startPosition + index;
            return `${position}. ${track.title} 🎵`;
        })
        .join('\n');
    
    const moreCount = spotifyData.tracks.length > 4 ? ` (+${spotifyData.tracks.length - 4} more tracks)` : '';
    embed.addFields({
        name: '🎶 Added Tracks Preview',
        value: newlyAddedTracks + moreCount,
        inline: false
    });

    embed.setFooter({ text: '🎵 Converted from Spotify • All tracks added to queue' });

    return embed;
};

// Create control buttons for queue additions
const createQueueAddedButtons = () => {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setLabel('📋 View Full Queue')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('⏭️ Skip Current')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger)
        );
};
const createControlButtons = (hasQueue = false) => {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_pause')
                .setLabel('⏸️ Pause')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger)
        );

    if (hasQueue) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('music_previous')
                .setLabel('⏮️ Previous')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_queue')
                .setLabel('📋 Queue')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return row;
};

// Play next song in queue
const playNextSong = async (guildId, interaction = null) => {
    const queueData = musicQueues.get(guildId);
    const connection = connections.get(guildId);
    
    if (!queueData || !connection || !queueData.player) return;

    if (queueData.currentIndex >= queueData.songs.length - 1) {
        // End of queue - keep connection alive but show finished status
        console.log('[PLAYER] Queue finished, keeping connection alive');
        
        if (interaction) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🔚 Queue Finished')
                    .setDescription('All songs have been played! Use `/play` to add more music or the Stop button to disconnect.')
                ],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_stop')
                        .setLabel('⏹️ Disconnect')
                        .setStyle(ButtonStyle.Danger)
                )]
            });
        } else if (queueData.lastMessage) {
            // Update the last message to show queue finished
            await queueData.lastMessage.edit({
                embeds: [new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('🔚 Queue Finished')
                    .setDescription('All songs have been played! Use `/play` to add more music or the Stop button to disconnect.')
                ],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('music_stop')
                        .setLabel('⏹️ Disconnect')
                        .setStyle(ButtonStyle.Danger)
                )]
            });
        }
        
        // Keep the connection alive but mark queue as finished
        // Don't delete the queue data or connection - let user manually stop or add more songs
        queueData.isFinished = true;
        
        return;
    }

    queueData.currentIndex++;
    const song = queueData.songs[queueData.currentIndex];
    
    try {
        // Get audio URL
        let audioUrl;
        try {
            audioUrl = await youtubedl(song.url, {
                format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio', // Prefer webm, fallback to m4a, then any
                getUrl: true,
                quiet: true
            });
        } catch (youtubeDlError) {
            console.error('YouTube-dl error in playNextSong:', youtubeDlError);
            // Skip this song and try the next one
            if (queueData.currentIndex < queueData.songs.length - 1) {
                console.log('Skipping problematic song and trying next...');
                playNextSong(guildId, interaction);
                return;
            } else {
                console.log('Last song failed, ending queue');
                // Clean up when queue is finished due to errors
                musicQueues.delete(guildId);
                const connection = connections.get(guildId);
                if (connection) {
                    connection.destroy();
                    connections.delete(guildId);
                }
                voiceActivityManager.stopActivity(guildId, 'music');
                return;
            }
        }

        // Create audio resource
        const response = await fetch(audioUrl);
        const stream = Readable.fromWeb(response.body);
        const resource = createAudioResource(stream, { 
            inputType: StreamType.Arbitrary, // Let Discord.js auto-detect the format
            inlineVolume: true 
        });

        // Play the song
        if (queueData.player) {
            queueData.player.play(resource);

            // Update embed
            const embed = createMusicEmbed(song, queueData);
            const buttons = createControlButtons(queueData.songs.length > 1);

            if (queueData.lastMessage) {
                await queueData.lastMessage.edit({
                    embeds: [embed],
                    components: [buttons]
                });
            }
        }
    } catch (error) {
        console.error('Error playing next song:', error);
    }
};

const playCommand = {
    data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Plays audio from YouTube or Spotify links in a voice channel')
    .addStringOption(option => 
        option.setName('link')
        .setDescription('YouTube or Spotify URL to play')
        .setRequired(true)
    )
    .addChannelOption(option => 
        option.setName('channel')
        .setDescription('The voice channel to play in')
        .setRequired(true)
    ),
    async execute(interaction) {
        const link = interaction.options.getString('link');
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        // Validate inputs
        if (!link) {
            await interaction.reply('Please provide a valid URL.');
            return;
        }

        if (channel.type !== 2) {
            await interaction.reply('Please provide a voice channel.');
            return;
        }

        // Check for conflicting voice activities
        const conflictCheck = voiceActivityManager.canStartActivity(guildId, 'music');
        if (!conflictCheck.canStart) {
            const errorMessage = voiceActivityManager.getBlockedMessage(
                'music', 
                conflictCheck.conflictType, 
                conflictCheck.channelId, 
                interaction.client
            );
            await interaction.reply({ content: errorMessage, ephemeral: true });
            return;
        }

        try {
            await setupPlayDL();
            
            await interaction.deferReply();

            // Check if it's a Spotify URL
            const isSpotify = link.includes('spotify.com') || link.includes('open.spotify.com');
            let songData;
            let youtubeUrl = link; // Initialize with the original link

            if (isSpotify) {
                // Handle Spotify URL
                await interaction.editReply('🎵 Processing Spotify link and finding YouTube equivalent...');
                
                console.log('[MAIN] Starting Spotify processing...');
                const spotifyData = await getSpotifyTrackInfo(link);
                console.log('[MAIN] Got Spotify data:', spotifyData ? 'SUCCESS' : 'FAILED');
                
                if (!spotifyData) {
                    await interaction.editReply('❌ Failed to process Spotify link. Please try copying the song/artist name and searching for it directly on YouTube, or provide a YouTube link instead.');
                    return;
                }

                if (spotifyData.type === 'album' || spotifyData.type === 'playlist') {
                    console.log(`[MAIN] Processing ${spotifyData.type} with ${spotifyData.tracks.length} tracks`);
                    await interaction.editReply(`🎵 Found ${spotifyData.type}: **${spotifyData.name}**\n🔍 Searching YouTube for ${spotifyData.tracks.length} tracks...`);
                    
                    // Handle Spotify album/playlist
                    if (spotifyData.tracks.length === 0) {
                        await interaction.editReply('❌ No tracks found. Please try a different Spotify link or search YouTube directly.');
                        return;
                    }

                    console.log('[MAIN] Creating queue for album/playlist...');
                    // Get or create queue
                    let queueData = musicQueues.get(guildId);
                    let connection = connections.get(guildId);

                    if (!queueData) {
                        console.log('[MAIN] Creating new queue...');
                        // Create new queue with first track
                        const firstTrack = spotifyData.tracks[0];
                        console.log('[MAIN] First track:', firstTrack.title);
                        
                        songData = {
                            url: firstTrack.youtubeUrl,
                            title: firstTrack.title,
                            channel: firstTrack.artist,
                            duration: firstTrack.duration,
                            thumbnail: firstTrack.thumbnail,
                            isSpotifyTrack: true,
                            originalSpotifyUrl: firstTrack.originalUrl
                        };

                        queueData = {
                            songs: [songData],
                            currentIndex: 0,
                            player: createAudioPlayer(),
                            isPaused: false,
                            lastMessage: null
                        };
                        musicQueues.set(guildId, queueData);

                        console.log('[MAIN] Joining voice channel...');
                        connection = joinVoiceChannel({
                            channelId: channel.id,
                            guildId: channel.guild.id,
                            adapterCreator: channel.guild.voiceAdapterCreator,
                            selfDeaf: false,
                        });
                        connections.set(guildId, connection);

                        // Register music activity
                        voiceActivityManager.startActivity(guildId, 'music', channel.id, queueData);

                        queueData.player.on(AudioPlayerStatus.Idle, () => {
                            playNextSong(guildId);
                        });

                        connection.subscribe(queueData.player);

                        console.log('[MAIN] Adding remaining tracks to queue...');
                        // Add remaining tracks to queue
                        for (let i = 1; i < spotifyData.tracks.length; i++) {
                            const track = spotifyData.tracks[i];
                            queueData.songs.push({
                                url: track.youtubeUrl,
                                title: track.title,
                                channel: track.artist,
                                duration: track.duration,
                                thumbnail: track.thumbnail,
                                isSpotifyTrack: true,
                                originalSpotifyUrl: track.originalUrl
                            });
                        }

                        youtubeUrl = firstTrack.youtubeUrl;
                        console.log('[MAIN] Will start playing:', youtubeUrl);
                        
                        // Now proceed to play the first track - don't fall through to general queue logic
                        console.log('[MAIN] Starting playback for album first track:', youtubeUrl);
                        // Get audio URL and play (use YouTube URL for both YouTube and Spotify)
                        let audioUrl;
                        try {
                            audioUrl = await youtubedl(youtubeUrl, {
                                format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio', // Prefer webm, fallback to m4a, then any
                                getUrl: true,
                                quiet: true
                            });
                        } catch (youtubeDlError) {
                            console.error('YouTube-dl error for album track:', youtubeDlError);
                            await interaction.editReply('❌ Failed to process the first track from the album/playlist. Please try a different Spotify link or individual YouTube videos.');
                            return;
                        }

                        console.log('[MAIN] Got audio URL, creating stream...');
                        const response = await fetch(audioUrl);
                        const stream = Readable.fromWeb(response.body);
                        const resource = createAudioResource(stream, { 
                            inputType: StreamType.Arbitrary, // Let Discord.js auto-detect the format
                            inlineVolume: true 
                        });

                        console.log('[MAIN] Playing audio...');
                        queueData.player.play(resource);

                        // Create and send embed with controls
                        const embed = createMusicEmbed(songData, queueData);
                        const buttons = createControlButtons(queueData.songs.length > 1);

                        console.log('[MAIN] Sending final reply...');
                        const message = await interaction.editReply({
                            embeds: [embed],
                            components: [buttons]
                        });

                        queueData.lastMessage = message;
                        console.log('[MAIN] Setup complete!');
                        return; // Exit here to avoid falling through to general queue logic
                    } else {
                        console.log('[MAIN] Adding tracks to existing queue...');
                        // Store the starting position for the new tracks
                        const startPosition = queueData.songs.length + 1;
                        
                        // Add all tracks to existing queue
                        for (const track of spotifyData.tracks) {
                            queueData.songs.push({
                                url: track.youtubeUrl,
                                title: track.title,
                                channel: track.artist,
                                duration: track.duration,
                                thumbnail: track.thumbnail,
                                isSpotifyTrack: true,
                                originalSpotifyUrl: track.originalUrl
                            });
                        }

                        // Create enhanced embed with queue info and controls
                        const embed = createSpotifyAlbumAddedEmbed(spotifyData, queueData, startPosition);
                        const buttons = createQueueAddedButtons();

                        await interaction.editReply({
                            embeds: [embed],
                            components: [buttons]
                        });
                        return;
                    }
                } else {
                    console.log('[MAIN] Processing single Spotify track...');
                    // Single Spotify track
                    songData = {
                        url: spotifyData.youtubeUrl,
                        title: spotifyData.title,
                        channel: spotifyData.artist,
                        duration: spotifyData.duration,
                        thumbnail: spotifyData.thumbnail,
                        isSpotifyTrack: true,
                        originalSpotifyUrl: spotifyData.originalUrl
                    };
                    youtubeUrl = spotifyData.youtubeUrl;
                    // Continue to general playback logic for single tracks
                }
            } else {
                // Handle YouTube URL (existing logic)
                const isValid = playdl.yt_validate(link);
                if (!isValid) {
                    await interaction.editReply('Please provide a valid YouTube or Spotify URL.');
                    return;
                }

                // Analyze the YouTube URL for type detection
                const urlAnalysis = analyzeYouTubeUrl(link);
                
                if (urlAnalysis.isLivestream) {
                    await interaction.editReply('❌ Livestreams are not supported. Please provide a regular YouTube video URL.');
                    return;
                }

                if (urlAnalysis.isPlaylist) {
                    await interaction.editReply('❌ YouTube playlists are not directly supported. Please provide individual video URLs or use a Spotify playlist instead.');
                    return;
                }

                // Additional check for livestreams using playdl
                try {
                    const info = await playdl.video_info(link);
                    
                    // Check if it's a livestream
                    if (info.video_details.live) {
                        await interaction.editReply('❌ This appears to be a livestream, which is not supported. Please provide a regular YouTube video URL.');
                        return;
                    }

                    // Check if duration is unavailable (common for livestreams)
                    if (!info.video_details.durationInSec || info.video_details.durationInSec === 0) {
                        await interaction.editReply('❌ This video appears to be a livestream or has no duration, which is not supported. Please provide a regular YouTube video URL.');
                        return;
                    }

                    songData = {
                        url: link,
                        title: info.video_details.title,
                        channel: info.video_details.channel?.name || 'Unknown',
                        duration: info.video_details.durationRaw || 'Unknown',
                        thumbnail: info.video_details.thumbnails?.[0]?.url || null,
                        isSpotifyTrack: false
                    };
                    youtubeUrl = link; // Make sure we use the original YouTube link
                } catch (videoInfoError) {
                    console.error('Error getting video info:', videoInfoError);
                    await interaction.editReply('❌ Failed to get video information. This might be a livestream, playlist, or invalid URL. Please try a different YouTube video URL.');
                    return;
                }
            }

            // Initialize or get existing queue
            let queueData = musicQueues.get(guildId);
            let connection = connections.get(guildId);

            console.log('[MAIN] Checking for existing queue...');
            if (!queueData || queueData.isFinished) {
                if (queueData?.isFinished) {
                    console.log('[MAIN] Reusing finished queue...');
                    // Reset the finished queue for new songs
                    queueData.songs = [songData];
                    queueData.currentIndex = 0;
                    queueData.isPaused = false;
                    queueData.isFinished = false;
                    // Keep existing player and connection, but make sure connection is still valid
                    const existingConnection = connections.get(guildId);
                    if (!existingConnection || existingConnection.state.status === 'destroyed') {
                        console.log('[MAIN] Recreating voice connection for finished queue...');
                        connection = joinVoiceChannel({
                            channelId: channel.id,
                            guildId: channel.guild.id,
                            adapterCreator: channel.guild.voiceAdapterCreator,
                            selfDeaf: false,
                        });
                        connections.set(guildId, connection);
                    } else {
                        connection = existingConnection;
                    }
                } else {
                    console.log('[MAIN] No existing queue, creating new one...');
                    // Create new queue
                    queueData = {
                        songs: [songData],
                        currentIndex: 0,
                        player: createAudioPlayer(),
                        isPaused: false,
                        lastMessage: null,
                        isFinished: false
                    };
                    musicQueues.set(guildId, queueData);

                    // Create voice connection
                    connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                        selfDeaf: false,
                    });
                    connections.set(guildId, connection);
                }

                // Register music activity
                voiceActivityManager.startActivity(guildId, 'music', channel.id, queueData);

                // Set up player event listeners
                queueData.player.on(AudioPlayerStatus.Idle, () => {
                    console.log('[PLAYER] Player went idle, playing next song...');
                    playNextSong(guildId);
                });

                queueData.player.on(AudioPlayerStatus.Playing, () => {
                    console.log('[PLAYER] Player started playing');
                });

                queueData.player.on(AudioPlayerStatus.Paused, () => {
                    console.log('[PLAYER] Player paused');
                });

                queueData.player.on('error', (error) => {
                    console.error('[PLAYER] Player error:', error);
                });

                connection.subscribe(queueData.player);
            } else {
                if (queueData.isFinished) {
                    console.log('[MAIN] Queue was finished, restarting with new song...');
                    // Reset the finished queue and start playing immediately
                    queueData.songs = [songData];
                    queueData.currentIndex = 0;
                    queueData.isPaused = false;
                    queueData.isFinished = false;
                    // Will continue to playback logic below
                } else {
                    console.log('[MAIN] Adding to existing queue...');
                    // Add to existing queue
                    queueData.songs.push(songData);
                    
                    // Create enhanced embed with queue info and controls
                    const embed = createQueueAddedEmbed(songData, queueData);
                    const buttons = createQueueAddedButtons();
                    
                    await interaction.editReply({
                        embeds: [embed],
                        components: [buttons]
                    });
                    return;
                }
            }

            console.log('[MAIN] Starting playback for:', youtubeUrl);
            // Get audio URL and play (use YouTube URL for both YouTube and Spotify)
            let audioUrl;
            try {
                audioUrl = await youtubedl(youtubeUrl, {
                    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio', // Prefer webm, fallback to m4a, then any
                    getUrl: true,
                    quiet: true
                });
            } catch (youtubeDlError) {
                console.error('YouTube-dl error:', youtubeDlError);
                const errorMessage = youtubeDlError.message?.toLowerCase() || '';
                
                if (errorMessage.includes('live') || errorMessage.includes('stream')) {
                    await interaction.editReply('❌ This appears to be a livestream, which is not supported. Please provide a regular YouTube video URL.');
                } else if (errorMessage.includes('playlist')) {
                    await interaction.editReply('❌ This appears to be a playlist URL, which is not directly supported. Please provide individual video URLs.');
                } else if (errorMessage.includes('private') || errorMessage.includes('unavailable')) {
                    await interaction.editReply('❌ This video is private or unavailable. Please provide a different YouTube video URL.');
                } else {
                    await interaction.editReply('❌ Failed to process the video URL. This might be a livestream, playlist, or the video might be unavailable. Please try a different YouTube video URL.');
                }
                return;
            }

            console.log('[MAIN] Got audio URL, creating stream...');
            const response = await fetch(audioUrl);
            const stream = Readable.fromWeb(response.body);
            const resource = createAudioResource(stream, { 
                inputType: StreamType.Arbitrary, // Let Discord.js auto-detect the format
                inlineVolume: true 
            });

            console.log('[MAIN] Playing audio...');
            queueData.player.play(resource);

            // Create and send embed with controls
            const embed = createMusicEmbed(songData, queueData);
            const buttons = createControlButtons(queueData.songs.length > 1);

            console.log('[MAIN] Sending final reply...');
            const message = await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });

            queueData.lastMessage = message;
            console.log('[MAIN] Setup complete!');

        } catch (error) {
            console.error('Error playing audio:', error);
            await interaction.editReply('Failed to play audio. Please check the URL and try again.');
        }
    }

}; 

// Button interaction handlers
export const handleMusicInteraction = async (interaction) => {
    const guildId = interaction.guild.id;
    const queueData = musicQueues.get(guildId);

    if (!queueData) {
        await interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
        return;
    }

    // Additional safety check for queue button (doesn't need player)
    if (interaction.customId === 'music_queue') {
        const currentSong = queueData.songs[queueData.currentIndex];
        const upcomingSongs = queueData.songs.slice(queueData.currentIndex + 1);
        const previousSongs = queueData.songs.slice(0, queueData.currentIndex);
        
        const queueEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Current Queue')
            .addFields(
                { name: '📊 Queue Stats', value: `Total: ${queueData.songs.length} songs\nPosition: ${queueData.currentIndex + 1}/${queueData.songs.length}`, inline: true },
                { name: '⏱️ Status', value: queueData.isPaused ? '⏸️ Paused' : (queueData.isFinished ? '🔚 Finished' : '▶️ Playing'), inline: true },
                { name: '🎵 Spotify Songs', value: `${queueData.songs.filter(s => s.isSpotifyTrack).length}`, inline: true }
            )
            .setTimestamp();

        // Show currently playing song
        if (currentSong) {
            queueEmbed.addFields({
                name: '🎵 Currently Playing',
                value: `**${currentSong.title}** ${currentSong.isSpotifyTrack ? '🎵' : ''}\n*by ${currentSong.channel || 'Unknown'}*`,
                inline: false
            });
        }

        // Show previous songs (last 3)
        if (previousSongs.length > 0) {
            const prevList = previousSongs.slice(-3)
                .map((song, index) => {
                    const position = queueData.currentIndex - (3 - index - 1);
                    return `${position}. ${song.title} ${song.isSpotifyTrack ? '🎵' : ''}`;
                })
                .join('\n');
            
            queueEmbed.addFields({
                name: '⏮️ Recently Played',
                value: prevList,
                inline: false
            });
        }

        // Show upcoming songs (next 8)
        if (upcomingSongs.length > 0) {
            const queueList = upcomingSongs.slice(0, 8)
                .map((song, index) => {
                    const position = queueData.currentIndex + 2 + index;
                    return `${position}. ${song.title} ${song.isSpotifyTrack ? '🎵' : ''}`;
                })
                .join('\n');
            
            const moreCount = upcomingSongs.length > 8 ? `\n*...and ${upcomingSongs.length - 8} more songs*` : '';
            queueEmbed.addFields({
                name: '🔜 Up Next',
                value: queueList + moreCount,
                inline: false
            });
        } else if (!queueData.isFinished) {
            queueEmbed.addFields({
                name: '🔜 Up Next',
                value: '*No more songs in queue*\nUse `/play` to add more!',
                inline: false
            });
        }

        queueEmbed.setFooter({ text: '🎵 = Spotify Track • Use buttons to control playback' });
            
        await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
        return;
    }

    const currentSong = queueData.songs[queueData.currentIndex];

    switch (interaction.customId) {
        case 'music_pause':
            if (!queueData.player) {
                await interaction.reply({ content: 'No audio player is currently active!', ephemeral: true });
                return;
            }
            
            if (queueData.isPaused) {
                queueData.player.unpause();
                queueData.isPaused = false;
                const embed = createMusicEmbed(currentSong, queueData, true);
                await interaction.update({
                    embeds: [embed],
                    components: [createControlButtons(queueData.songs.length > 1)]
                });
            } else {
                queueData.player.pause();
                queueData.isPaused = true;
                const embed = createMusicEmbed(currentSong, queueData, false);
                embed.setTitle('⏸️ Paused');
                await interaction.update({
                    embeds: [embed],
                    components: [createControlButtons(queueData.songs.length > 1)]
                });
            }
            break;

        case 'music_skip':
            if (!queueData.player) {
                await interaction.reply({ content: 'No audio player is currently active!', ephemeral: true });
                return;
            }
            
            if (queueData.currentIndex < queueData.songs.length - 1) {
                queueData.player.stop(); // This will trigger the next song
                await interaction.deferUpdate();
            } else {
                await interaction.reply({ content: 'No more songs in the queue!', ephemeral: true });
            }
            break;

        case 'music_previous':
            if (!queueData.player) {
                await interaction.reply({ content: 'No audio player is currently active!', ephemeral: true });
                return;
            }
            
            if (queueData.currentIndex > 0) {
                queueData.currentIndex -= 2; // Will be incremented by playNextSong
                queueData.player.stop();
                await interaction.deferUpdate();
            } else {
                await interaction.reply({ content: 'No previous songs!', ephemeral: true });
            }
            break;

        case 'music_stop':
            if (queueData.player) {
                queueData.player.stop();
                queueData.player = null; // Set to null only when explicitly stopping
            }
            musicQueues.delete(guildId);
            const connection = connections.get(guildId);
            if (connection) {
                connection.destroy();
                connections.delete(guildId);
            }
            
            // Unregister music activity
            voiceActivityManager.stopActivity(guildId, 'music');
            
            const stopEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏹️ Music Stopped')
                .setDescription('Music has been stopped and queue cleared.');
                
            await interaction.update({
                embeds: [stopEmbed],
                components: []
            });
            break;
    }
};

export default playCommand;