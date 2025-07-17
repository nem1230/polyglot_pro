// JavaScript classes for structured output schemas
// These work similarly to Pydantic classes in Python

export class BaseSchema {
  getJsonSchema() {
    throw new Error('getJsonSchema must be implemented by subclass');
  }
}

export class ObjectDetectionOutput extends BaseSchema {
  getJsonSchema() {
    return {
      type: "object",
      properties: {
        objects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              description: { type: "string" }
            },
            required: ["name", "confidence", "description"]
          }
        },
        scene: {
          type: "object",
          properties: {
            setting: { type: "string" },
            location: { type: "string" },
            activity: { type: "string" },
            mood: { type: "string" }
          },
          required: ["setting", "location", "activity", "mood"]
        }
      },
      required: ["objects", "scene"]
    };
  }
}

export class VocabularyOutput extends BaseSchema {
  getJsonSchema() {
    return {
      type: "object",
      properties: {
        vocabulary: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              translation: { type: "string" },
              category: { 
                type: "string",
                enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "interjection"]
              },
              difficulty: {
                type: "string",
                enum: ["beginner", "intermediate", "advanced"]
              },
              example: { type: "string" },
              context: { type: "string" },
              phonetic: { type: "string" }
            },
            required: ["word", "translation", "category", "difficulty", "example", "context"]
          }
        }
      },
      required: ["vocabulary"]
    };
  }
}

export class StoryOutput extends BaseSchema {
  getJsonSchema() {
    return {
      type: "object",
      properties: {
        story: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            difficulty: {
              type: "string",
              enum: ["beginner", "intermediate", "advanced"]
            },
            word_count: { type: "integer", minimum: 0 },
            key_vocabulary: {
              type: "array",
              items: { type: "string" }
            },
            moral: { type: "string" },
            translation: { type: "string" }
          },
          required: ["title", "content", "difficulty", "word_count", "key_vocabulary", "moral", "translation"]
        }
      },
      required: ["story"]
    };
  }
}

export class ConversationOutput extends BaseSchema {
  getJsonSchema() {
    return {
      type: "object",
      properties: {
        scenario: { type: "string" },
        participants: {
          type: "array",
          items: { type: "string" }
        },
        difficulty: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced"]
        },
        dialogue: {
          type: "array",
          items: {
            type: "object",
            properties: {
              speaker: { type: "string" },
              text: { type: "string" },
              translation: { type: "string" }
            },
            required: ["speaker", "text", "translation"]
          }
        },
        cultural_notes: { type: "string" }
      },
      required: ["scenario", "participants", "difficulty", "dialogue", "cultural_notes"]
    };
  }
}