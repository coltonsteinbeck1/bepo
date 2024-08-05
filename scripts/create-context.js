import {getContext} from "../src/supabase/supabase.js";
import dotenv from "dotenv";
dotenv.config();

const systemMessages = [{role:'system', content: process.env.MODEL_SYSTEM_MESSAGE}];

async function getAllContext(){
    const messages = await getContext();
    const formattedMessages = [...systemMessages];
    
    messages.forEach(message => {
       const formattedMessage = {role: 'user', content: message.content}
        formattedMessages.push(formattedMessage);
    });
    return formattedMessages;
}

async function randomizeReaction(probability){
    return Math.random() < probability;
}
export {getAllContext, randomizeReaction};


