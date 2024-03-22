# DM Notes


## Gameplay

1. DM creates a campaign.
    - inputs: number of players, name of the campaign, 
    - outputs: "packet" with all the world information as a pdf and store relevant parts in db
2.   


---


## Components

 Game module: keeps track of game and player metadata
   - only accessible through slash commands 
   - `/list-campaigns`: lists all campaigns that the user is a part of in db
    ```
       my-dnd-campaign-1 (created: 01/01/01) 
       my-dnd-campaign-2 (created: 01/01/01) 
       my-dnd-campaign-3 (created: 01/01/01) 
    ```
 Story module: initiates openai thread to generate dm notes
   - `/create-campaign`: starts thread 
       - user / model create story together 
       - thread save to the db with campaign name
   - `/get-campaign`: <campaign-name (e.g. my-dnd-campaign-1)>
       - fetches thread id from db
       - provides thread id to openai
       - user / model continue interacting on thread

