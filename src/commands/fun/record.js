/**
 * Record Command - Generate videos using OpenAI Sora 2
 * Allows users to create videos from text prompts with optional reference images
 */

import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    AttachmentBuilder, 
    MessageFlags 
} from "discord.js";
import { 
    generateVideo, 
    pollVideoStatus, 
    validateVideoParams, 
    extractImageAttachments 
} from "../../services/soraVideoService.js";
import { 
    insertVideo, 
    updateVideoStatus, 
    updateVideoWithOpenAIId 
} from "../../supabase/supabase.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const recordCommand = {
    data: new SlashCommandBuilder()
        .setName("record")
        .setDescription("Generate a video using AI (Sora 2) from your text prompt")
        .addStringOption((option) =>
            option
                .setName("prompt")
                .setDescription("Describe the video you want to create")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("resolution")
                .setDescription("Video resolution and orientation (reference image must match exactly!)")
                .setRequired(false)
                .addChoices(
                    { name: "HD Landscape (1280x720)", value: "1280x720" },
                    { name: "HD Portrait (720x1280)", value: "720x1280" }
                )
        )
        .addAttachmentOption((option) =>
            option
                .setName("image1")
                .setDescription("Reference image as first frame (MUST match resolution exactly!)")
                .setRequired(false)
        ),

    async execute(interaction) {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_KEY) {
            return await interaction.reply({
                content: "❌ OpenAI API key not configured. Please contact the bot administrator.",
                flags: MessageFlags.Ephemeral,
            });
        }

        // Get command options
        const prompt = interaction.options.getString("prompt");
        const resolution = interaction.options.getString("resolution") || "1280x720";

        // Extract reference image from attachment (only supports 1 image)
        let referenceImages = [];
        const attachment = interaction.options.getAttachment("image1");
        
        if (attachment) {
            // Validate that it's an image
            if (attachment.contentType?.startsWith("image/")) {
                referenceImages.push(attachment.url);
                console.log(`📎 Reference image added: ${attachment.name}`);
            } else {
                return await interaction.reply({
                    content: "❌ Invalid file type. Please attach an image file (JPEG, PNG, or WebP).",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
        
        // Validate parameters
        const validation = validateVideoParams(prompt, referenceImages);
        if (!validation.valid) {
            return await interaction.reply({
                content: `❌ Invalid parameters:\n${validation.errors.join("\n")}`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // Defer reply as video generation takes time
        await interaction.deferReply();

        try {
            // Create initial video record in database
            const videoRecord = await insertVideo(
                interaction.user.id,
                interaction.guildId,
                interaction.channelId,
                prompt,
                referenceImages,
                {
                    resolution,
                    username: interaction.user.username,
                }
            );

            if (!videoRecord) {
                throw new Error("Failed to create video record in database");
            }

            // Send initial status message
            const initialEmbed = new EmbedBuilder()
                .setColor("#FFA500")
                .setTitle(prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt)
                .setDescription(`🎬 **Video Generation Started**\nCreating your video with Sora 2...`)
                .addFields(
                    { name: "Resolution", value: resolution, inline: true },
                    { name: "Reference Image", value: referenceImages.length > 0 ? "✅ Using as first frame" : "None", inline: true },
                    { name: "Status", value: "⏳ Initializing...", inline: false }
                )
                .setFooter({ text: `Video ID: ${videoRecord.id}` })
                .setTimestamp();
            
            // Add reference image thumbnails if provided (for visual reference only)
            if (referenceImages.length > 0) {
                initialEmbed.setThumbnail(referenceImages[0]);
            }

            const statusMessage = await interaction.editReply({ embeds: [initialEmbed] });

            // Start video generation with Sora API
            const generationResult = await generateVideo(prompt, referenceImages, {
                resolution,
            });

            if (!generationResult.success) {
                await updateVideoStatus(videoRecord.id, "failed", null, generationResult.error);
                throw new Error(generationResult.error || "Video generation failed");
            }

            // Update database with OpenAI video ID
            await updateVideoWithOpenAIId(videoRecord.id, generationResult.videoId);

            // Update status message (edit the same embed)
            const processingEmbed = new EmbedBuilder()
                .setColor("#FFA500")
                .setTitle(prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt)
                .setDescription(`🎨 **Processing**\nSora 2 is creating your video...\n\n_This may take 15-30 minutes. Updates every 10 seconds._`)
                .addFields(
                    { name: "Resolution", value: resolution, inline: true },
                    { name: "Reference Image", value: referenceImages.length > 0 ? "✅ Using as first frame" : "None", inline: true },
                    { name: "Status", value: "⏳ Queued / Processing...", inline: false }
                )
                .setFooter({ text: `Video ID: ${videoRecord.id} | OpenAI ID: ${generationResult.videoId}` })
                .setTimestamp();
            
            // Add reference image thumbnails if provided
            if (referenceImages.length > 0) {
                processingEmbed.setThumbnail(referenceImages[0]);
            }

            await interaction.editReply({ embeds: [processingEmbed] });

            // Poll for completion (background process - don't block the interaction)
            // In production, you might want to use a separate worker/queue system
            // Note: Sora 2 videos can take 15-30+ minutes to generate
            pollForVideoCompletion(
                videoRecord.id,
                generationResult.videoId,
                interaction,
                prompt,
                resolution,
                referenceImages,
                statusMessage // Pass the message to edit
            ).catch(console.error);

        } catch (error) {
            console.error("Error in record command:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("❌ Video Generation Failed")
                .setDescription(`Sorry, I couldn't generate your video.`)
                .addFields(
                    { name: "Error", value: error.message || "Unknown error", inline: false },
                    { name: "Prompt", value: prompt.substring(0, 500), inline: false }
                )
                .setFooter({ text: "Please try again or contact support if the issue persists" })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};

/**
 * Poll for video completion and update the user
 * Runs asynchronously after the initial interaction
 */
async function pollForVideoCompletion(videoId, openaiVideoId, interaction, prompt, resolution, referenceImages = [], statusMessage = null) {
    try {
        console.log(`📊 Starting polling for video ${videoId}...`);

        // Poll every 10 seconds for up to 30 minutes (180 attempts)
        // Sora 2 videos typically take 15-30+ minutes depending on complexity and queue
        const result = await pollVideoStatus(openaiVideoId, 180, 10000);

        if (result.success && result.completed) {
            // Check if we got the video buffer
            if (!result.videoBuffer) {
                console.error(`❌ Video marked as completed but no video buffer retrieved`);
                console.log(`   Response data:`, JSON.stringify(result.data, null, 2));
                
                await updateVideoStatus(videoId, "failed", null, "Video completed but failed to retrieve video content from OpenAI.");
                
                const noContentEmbed = new EmbedBuilder()
                    .setColor("#FF6600")
                    .setTitle(prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt)
                    .setDescription(`⚠️ **Video Generation Issue**\nThe video generation completed, but we couldn't retrieve the video content.`)
                    .addFields(
                        { name: "Status", value: "Failed to download video from OpenAI", inline: false },
                        { name: "OpenAI Video ID", value: openaiVideoId, inline: false },
                        { name: "What to do", value: "Check the OpenAI dashboard or try again", inline: false }
                    )
                    .setFooter({ text: `Video ID: ${videoId}` })
                    .setTimestamp();
                
                try {
                    // Edit the existing message instead of sending new one
                    if (statusMessage) {
                        await statusMessage.edit({ embeds: [noContentEmbed] });
                    } else {
                        await interaction.followUp({ embeds: [noContentEmbed] });
                    }
                } catch (err) {
                    console.error("Error updating no-content message:", err);
                }
                return;
            }

            console.log(`✅ Video buffer received: ${result.videoBuffer.length} bytes`);

            // Update database with completed video (no URL since we have the buffer directly)
            await updateVideoStatus(videoId, "completed", `OpenAI Video ID: ${openaiVideoId}`);

            // Create Discord attachment from the video buffer
            let videoAttachment = null;
            try {
                videoAttachment = new AttachmentBuilder(
                    result.videoBuffer,
                    { name: `sora-video-${videoId}.mp4` }
                );
                console.log(`✅ Video attachment created successfully`);
            } catch (attachmentError) {
                console.error("Error creating video attachment:", attachmentError);
                // Continue without attachment
            }

            // Create completion embed
            const completedEmbed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle(prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt)
                .setDescription(`✅ **Video Generated Successfully!**\n_Video playable above ▶️_`)
                .addFields(
                    { name: "Resolution", value: resolution, inline: true },
                    { name: "Duration", value: result.data?.seconds ? `${result.data.seconds} seconds` : "Auto", inline: true },
                    { name: "Status", value: "✅ Completed", inline: false }
                )
                .setFooter({ text: `Video ID: ${videoId}` })
                .setTimestamp();

            // Try to update the existing message with video attachment
            // Note: Discord doesn't support embedding videos directly in embeds
            // Videos must be sent as file attachments and will appear with a play button
            try {
                const messageOptions = { embeds: [completedEmbed] };
                
                if (videoAttachment) {
                    // Attach video file - it will appear with a Discord video player
                    messageOptions.files = [videoAttachment];
                }
                
                // Edit the existing status message instead of sending a new one
                if (statusMessage) {
                    await statusMessage.edit(messageOptions);
                } else {
                    await interaction.followUp(messageOptions);
                }
            } catch (err) {
                console.error("Error updating completion message:", err);
                
                // If sending fails (maybe file too large), send without attachment
                if (videoAttachment) {
                    try {
                        const fallbackEmbed = new EmbedBuilder()
                            .setColor("#FF6600")
                            .setTitle("✅ Video Generated!")
                            .setDescription("Video generated successfully but was too large to attach directly to Discord.")
                            .addFields(
                                { name: "Prompt", value: prompt.substring(0, 1000), inline: false },
                                { name: "OpenAI Video ID", value: openaiVideoId, inline: false },
                                { name: "File Size", value: `${(result.videoBuffer.length / 1024 / 1024).toFixed(2)} MB`, inline: true },
                                { name: "Discord Limit", value: "25 MB for most servers", inline: true },
                                { name: "What to do", value: "Check the OpenAI dashboard to download your video", inline: false }
                            )
                            .setFooter({ text: `Video ID: ${videoId}` })
                            .setTimestamp();
                        
                        await interaction.followUp({ embeds: [fallbackEmbed] });
                    } catch (fallbackErr) {
                        console.error("Error sending fallback message:", fallbackErr);
                    }
                }
            }

        } else {
            // Generation failed or timed out
            const errorMessage = result.error || "Video generation timed out or failed";
            const isNetworkError = errorMessage.includes("Network connectivity") || errorMessage.includes("ENOTFOUND");
            
            await updateVideoStatus(videoId, isNetworkError ? "processing" : "failed", null, errorMessage);
            
            const failedEmbed = new EmbedBuilder()
                .setColor(isNetworkError ? "#FFA500" : "#FF6600")
                .setTitle(prompt.length > 100 ? prompt.substring(0, 97) + "..." : prompt)
                .setDescription(isNetworkError 
                    ? `🌐 **Network Connectivity Issue**\nLost connection to OpenAI while polling. Your video may still be processing.`
                    : `⚠️ **Video Generation Issue**\nThe video generation didn't complete successfully.`)
                .addFields(
                    { name: "Status", value: errorMessage, inline: false },
                    { name: isNetworkError ? "What to do" : "What to try", 
                      value: isNetworkError
                        ? `• Check OpenAI dashboard with video ID: ${openaiVideoId}\n• Video may complete successfully despite network error\n• Try the /record command again if needed`
                        : "• Try a simpler prompt\n• Use lower resolution\n• Try again in a few minutes", 
                      inline: false }
                )
                .setFooter({ text: `Video ID: ${videoId} | OpenAI ID: ${openaiVideoId}` })
                .setTimestamp();

            try {
                // Edit the existing message instead of sending new one
                if (statusMessage) {
                    await statusMessage.edit({ embeds: [failedEmbed] });
                } else {
                    await interaction.followUp({ embeds: [failedEmbed] });
                }
            } catch (err) {
                console.error("Error updating failure message:", err);
            }
        }
    } catch (error) {
        console.error(`Error polling video ${videoId}:`, error);
        await updateVideoStatus(videoId, "failed", null, error.message);
    }
}

export default recordCommand;
