export const creative_video_creator = {
    type: "function",
    function: {
        name: "creative_video_creator",
        description:
            "Use scenes to create a compelling video reel. The text overlay of each scene will make up the script of the video. Use those text overlays to tell the viewer a story--however short that story may be. Remember, you want to be creative but concise. Clever but clear. Trailblazing but relevant. Remember, this function is for YOU (THE AGENT) to use. Do not ask the user for more information if you can fill in the gaps yourself!",
        parameters: {
            type: "object",
            properties: {
                video_data: {
                    type: "object",
                    properties: {
                        scenes: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    video_clip: {
                                        type: "string",
                                        description: "short semantic description of the video clip"
                                    },
                                    text_overlay: {
                                        type: "string",
                                        description: "One sentence maximum! One idea per scene. ONE SENTENCE MAXIMUM! Each text overlay helps carry the message of the reel."
                                    }
                                },
                                required: ["video_clip", "text_overlay"]
                            }
                        },
                        music_clip: {
                            type: "string",
                            description: "short semantic description of the music clip"
                        }
                    },
                    required: ["scenes", "music_clip"]
                },
                caption_text: {
                    type: "string",
                    description: "caption text that elaborates on the ideas presented in the video"
                }
            },
            required: ["video_file", "caption_text"]
        }
    }
}
export type CreativeVideoEditorArgs = {
    video_data: {
        scenes: { video_clip: string; text_overlay: string }[]
        music_clip: string
    }
    caption_text: string
}
export const fetch_user_data = {
    type: "function",
    function: {
        name: "fetch_user_data",
        description: "Fetch information about the user.",
        parameters: {
            type: "object",
            properties: {
                user_id: {
                    type: "string"
                }
            },
            required: ["user_id"]
        }
    }
}
