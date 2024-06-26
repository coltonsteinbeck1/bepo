
import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Function to get all guilds
async function getAllGuilds() {
    const { data, error } = await supabase.from('guilds').select('*')
    if (error) {
        console.error('Error fetching guilds:', error)
        return []
    }
    return data
}

// Function to get all channels
async function getAllChannels() {
    const { data, error } = await supabase.from('channels').select('*')
    if (error) {
        console.error('Error fetching channels:', error)
        return []
    }
    return data
}

// Function to get all users
async function getAllUsers() {
    const { data, error } = await supabase.from('users').select('*')
    if (error) {
        console.error('Error fetching users:', error)
        return []
    }
    return data
}

async function getAllCommands() {
    const { data, error } = await supabase.from('commands').select('*')
    if (error) {
        console.error('Error fetching commands:', error)
        return []
    }
    return data
}
async function getConfig() {
    const { data, error } = await supabase.from('config').select('*')
    if (error) {
        console.error('Error fetching config:', error)
        return []
    }
    return data
}


async function insertImages(prompt, url) {
    initializeImageId();

    const { data, error } = await supabase
        .from('images')
        .insert([
            { image_id: initializeImageId+1, url: url, prompt: prompt },
        ])
        .select();
    if (error) {
        console.error('Error inserting image:', error)
        return []
    }
}
// Function to get all context messages
async function getContext() {
    let { data: messages, error } = await supabase.from('messages').select('content')       
    if (error) {
        console.error('Error fetching context:', error)
        return []
    }
    return messages
}
export { getAllGuilds, getAllChannels, getAllUsers, getConfig, insertImages, getContext }

