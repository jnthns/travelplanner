# Gemini API

The Gemini Interactions API is an experimental API that allows developers to build generative AI applications using Gemini models. Gemini is our most capable model, built from the ground up to be multimodal. It can generalize and seamlessly understand, operate across, and combine different types of information including language, images, audio, video, and code. You can use the Gemini API for use cases like reasoning across text and images, content generation, dialogue agents, summarization and classification systems, and more.

## Default

### Creating an interaction

`POST https://generativelanguage.googleapis.com/v1beta/interactions`

Creates a new interaction.


#### Request Body
- **model** (`<a href="#Resource:ModelOption">ModelOption</a>`) The name of the `Model` used for generating the interaction. <br><strong>Required if `agent` is not provided.</strong>
 Possible values:
 - `gemini-2.5-flash`: Our first hybrid reasoning model which supports a 1M token context window and has thinking budgets. - `gemini-2.5-flash-image`: Our native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash. - `gemini-2.5-flash-lite`: Our smallest and most cost effective model, built for at scale usage. - `gemini-2.5-flash-lite-preview-09-2025`: The latest model based on Gemini 2.5 Flash lite optimized for cost-efficiency, high throughput and high quality. - `gemini-2.5-flash-native-audio-preview-12-2025`: Our native audio models optimized for higher quality audio outputs with better pacing, voice naturalness, verbosity, and mood. - `gemini-2.5-flash-preview-09-2025`: The latest model based on the 2.5 Flash model. 2.5 Flash Preview is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases. - `gemini-2.5-flash-preview-tts`: Our 2.5 Flash text-to-speech model optimized for powerful, low-latency controllable speech generation. - `gemini-2.5-pro`: Our state-of-the-art multipurpose model, which excels at coding and complex reasoning tasks. - `gemini-2.5-pro-preview-tts`: Our 2.5 Pro text-to-speech audio model optimized for powerful, low-latency speech generation for more natural outputs and easier to steer prompts. - `gemini-3-flash-preview`: Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding. - `gemini-3-pro-image-preview`: State-of-the-art image generation and editing model. - `gemini-3-pro-preview`: Our most intelligent model with SOTA reasoning and multimodal understanding, and powerful agentic and vibe coding capabilities. - `gemini-3.1-pro-preview`: Our latest SOTA reasoning model with unprecedented depth and nuance, and powerful multimodal understanding and coding capabilities. - `gemini-3.1-flash-image-preview`: Pro-level visual intelligence with Flash-speed efficiency and reality-grounded generation capabilities.
- **agent** (`<a href="#Resource:AgentOption">AgentOption</a>`) The name of the `Agent` used for generating the interaction. <br><strong>Required if `model` is not provided.</strong>
 Possible values:
 - `deep-research-pro-preview-12-2025`: Gemini Deep Research Agent
- **input** (`<a href="#Resource:Content">Content</a> or array (<a href="#Resource:Content">Content</a>) or array (<a href="#Resource:Turn">Turn</a>) or string`) *(Required)* The inputs for the interaction (common to both Model and Agent).

- **system_instruction** (`string`) System instruction for the interaction.

- **tools** (`array (<a href="#Resource:Tool">Tool</a>)`) A list of tool declarations the model may call during interaction.

- **response_format** (`object`) Enforces that the generated response is a JSON object that complies with the JSON schema specified in this field.

- **response_mime_type** (`string`) The mime type of the response. This is required if response_format is set.

- **stream** (`boolean`) Input only. Whether the interaction will be streamed.

- **store** (`boolean`) Input only. Whether to store the response and request for later retrieval.

- **background** (`boolean`) Input only. Whether to run the model interaction in the background.

- **generation_config** (`<a href="#Resource:GenerationConfig">GenerationConfig</a>`) <strong>Model Configuration</strong><br>Configuration parameters for the model interaction. <br><em>Alternative to `agent_config`. Only applicable when `model` is set.</em>
 - **temperature** (`number`)  Controls the randomness of the output.

 - **top_p** (`number`)  The maximum cumulative probability of tokens to consider when sampling.

 - **seed** (`integer`)  Seed used in decoding for reproducibility.

 - **stop_sequences** (`array (string)`)  A list of character sequences that will stop output interaction.

 - **thinking_level** (`<a href="#Resource:ThinkingLevel">ThinkingLevel</a>`)  The level of thought tokens that the model should generate.
  Possible values:
  - `minimal`  - `low`  - `medium`  - `high`
 - **thinking_summaries** (`<a href="#Resource:ThinkingSummaries">ThinkingSummaries</a>`)  Whether to include thought summaries in the response.
  Possible values:
  - `auto`  - `none`
 - **max_output_tokens** (`integer`)  The maximum number of tokens to include in the response.

 - **speech_config** (`array (<a href="#Resource:SpeechConfig">SpeechConfig</a>)`)  Configuration for speech interaction.
  - **voice** (`string`)   The voice of the speaker.

  - **language** (`string`)   The language of the speech.

  - **speaker** (`string`)   The speaker's name, it should match the speaker name given in the prompt.


 - **image_config** (`<a href="#Resource:ImageConfig">ImageConfig</a>`)  Configuration for image interaction.
  - **aspect_ratio** (`enum (string)`)
   Possible values:
   - `1:1`   - `2:3`   - `3:2`   - `3:4`   - `4:3`   - `4:5`   - `5:4`   - `9:16`   - `16:9`   - `21:9`   - `1:8`   - `8:1`   - `1:4`   - `4:1`
  - **image_size** (`enum (string)`)
   Possible values:
   - `1K`   - `2K`   - `4K`   - `512`

 - **tool_choice** (`<a href="#Resource:ToolChoiceConfig">ToolChoiceConfig</a> or <a href="#Resource:ToolChoiceType">ToolChoiceType</a>`)  The tool choice for the interaction.


- **agent_config** (`<a href="#Resource:DeepResearchAgentConfig">DeepResearchAgentConfig</a> or <a href="#Resource:DynamicAgentConfig">DynamicAgentConfig</a>`) <strong>Agent Configuration</strong><br>Configuration for the agent. <br><em>Alternative to `generation_config`. Only applicable when `agent` is set.</em>
 **Possible Types:** (Discriminator: `type`) - **DynamicAgentConfig**: Configuration for dynamic agents.
  - **type** (`object`) *(Required)*
   Value: `dynamic`
 - **DeepResearchAgentConfig**: Configuration for the Deep Research agent.
  - **thinking_summaries** (`<a href="#Resource:ThinkingSummaries">ThinkingSummaries</a>`)   Whether to include thought summaries in the response.
   Possible values:
   - `auto`   - `none`
  - **type** (`object`) *(Required)*
   Value: `deep-research`

- **previous_interaction_id** (`string`) The ID of the previous interaction, if any.

- **response_modalities** (`array (<a href="#Resource:ResponseModality">ResponseModality</a>)`) The requested modalities of the response (TEXT, IMAGE, AUDIO).
 Possible values:
 - `text` - `image` - `audio`

#### Response
Returns [Interaction](#interaction) resources.

#### Examples
**Simple Request**

**REST**

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "input": "Hello, how are you?"
  }'

```
**Python**

```python
from google import genai

client = genai.Client()
interaction = client.interactions.create(
    model="gemini-3-flash-preview",
    input="Hello, how are you?",
)
print(interaction.outputs[-1].text)

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: 'Hello, how are you?',
});
console.log(interaction.outputs[interaction.outputs.length - 1].text);

```
Response:
```json
{
  "created": "2025-11-26T12:25:15Z",
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
  "outputs": [
    {
      "text": "Hello! I'm functioning perfectly and ready to assist you.\n\nHow are you doing today?",
      "type": "text"
    }
  ],
  "role": "model",
  "status": "completed",
  "updated": "2025-11-26T12:25:15Z",
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 7
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 7,
    "total_output_tokens": 20,
    "total_thought_tokens": 22,
    "total_tokens": 49,
    "total_tool_use_tokens": 0
  }
}
```
**Multi-turn**

**REST**

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "input": [
      {
        "role": "user",
        "content": "Hello!"
      },
      {
        "role": "model",
        "content": "Hi there! How can I help you today?"
      },
      {
        "role": "user",
        "content": "What is the capital of France?"
      }
    ]
  }'

```
**Python**

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    input=[
        { "role": "user", "content": "Hello!" },
        { "role": "model", "content": "Hi there! How can I help you today?" },
        { "role": "user", "content": "What is the capital of France?" }
    ]
)
print(response.outputs[-1].text)

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: [
        { role: 'user', content: 'Hello' },
        { role: 'model', content: 'Hi there! How can I help you today?' },
        { role: 'user', content: 'What is the capital of France?' }
    ]
});
console.log(interaction.outputs[interaction.outputs.length - 1].text);

```
Response:
```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "The capital of France is Paris."
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 50
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 50,
    "total_output_tokens": 10,
    "total_thought_tokens": 0,
    "total_tokens": 60,
    "total_tool_use_tokens": 0
  }
}
```
**Image Input**

**REST**

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "input": [
      {
        "type": "text",
        "text": "What is in this picture?"
      },
      {
        "type": "image",
        "data": "BASE64_ENCODED_IMAGE",
        "mime_type": "image/png"
      }
    ]
  }'

```
**Python**

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    input=[
      { "type": "text", "text": "What is in this picture?" },
      { "type": "image", "data": "BASE64_ENCODED_IMAGE", "mime_type": "image/png" }
    ]
)
print(response.outputs[-1].text)

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    input: [
      { type: 'text', text: 'What is in this picture?' },
      { type: 'image', data: 'BASE64_ENCODED_IMAGE', mime_type: 'image/png' }
    ]
});
console.log(interaction.outputs[interaction.outputs.length - 1].text);

```
Response:
```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "A white humanoid robot with glowing blue eyes stands holding a red skateboard."
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 10
      },
      {
        "modality": "image",
        "tokens": 258
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 268,
    "total_output_tokens": 20,
    "total_thought_tokens": 0,
    "total_tokens": 288,
    "total_tool_use_tokens": 0
  }
}
```
**Function Calling**

**REST**

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state, e.g. San Francisco, CA"
            }
          },
          "required": [
            "location"
          ]
        }
      }
    ],
    "input": "What is the weather like in Boston, MA?"
  }'

```
**Python**

```python
from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA"
                }
            },
            "required": ["location"]
        }
    }],
    input="What is the weather like in Boston, MA?"
)
print(response.outputs[0])

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA'
                }
            },
            required: ['location']
        }
    }],
    input: 'What is the weather like in Boston, MA?'
});
console.log(interaction.outputs[0]);

```
Response:
```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "requires_action",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "model",
  "outputs": [
    {
      "type": "function_call",
      "id": "gth23981",
      "name": "get_weather",
      "arguments": {
        "location": "Boston, MA"
      }
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 100
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 100,
    "total_output_tokens": 25,
    "total_thought_tokens": 0,
    "total_tokens": 125,
    "total_tool_use_tokens": 50
  }
}
```
**Deep Research**

**REST**

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "deep-research-pro-preview-12-2025",
    "input": "Find a cure to cancer",
    "background": true
  }'

```
**Python**

```python
from google import genai

client = genai.Client()
interaction = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="find a cure to cancer",
    background=True,
)
print(interaction.status)

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    agent: 'deep-research-pro-preview-12-2025',
    input: 'find a cure to cancer',
    background: true,
});
console.log(interaction.status);

```
Response:
```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "agent": "deep-research-pro-preview-12-2025",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:22:47Z",
  "updated": "2025-11-26T12:22:47Z",
  "role": "agent",
  "outputs": [
    {
      "type": "text",
      "text": "Here is a comprehensive research report on the current state of cancer research..."
    }
  ],
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 20
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 20,
    "total_output_tokens": 1000,
    "total_thought_tokens": 500,
    "total_tokens": 1520,
    "total_tool_use_tokens": 0
  }
}
```
---
### Retrieving an interaction

`GET https://generativelanguage.googleapis.com/v1beta/interactions/{id}`

Retrieves the full details of a single interaction based on its `Interaction.id`.

#### Parameters
- **id** (`string`) *(Required)* The unique identifier of the interaction to retrieve.

- **stream** (`boolean`) If set to true, the generated content will be streamed incrementally.
 Default: `False`
- **last_event_id** (`string`) Optional. If set, resumes the interaction stream from the next chunk after the event marked by the event id. Can only be used if `stream` is true.

- **include_input** (`boolean`) If set to true, includes the input in the response.
 Default: `False`
- **api_version** (`string`) Which version of the API to use.



#### Response
Returns [Interaction](#interaction) resources.

#### Examples
**Get Interaction**

**REST**

```sh
curl -X GET https://generativelanguage.googleapis.com/v1beta/interactions/v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg \
  -H "x-goog-api-key: $GEMINI_API_KEY"

```
**Python**

```python
from google import genai

client = genai.Client()

interaction = client.interactions.get(id="v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg")
print(interaction.status)

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.get('v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg');
console.log(interaction.status);

```
Response:
```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "model": "gemini-3-flash-preview",
  "status": "completed",
  "object": "interaction",
  "created": "2025-11-26T12:25:15Z",
  "updated": "2025-11-26T12:25:15Z",
  "role": "model",
  "outputs": [
    {
      "type": "text",
      "text": "I'm doing great, thank you for asking! How can I help you today?"
    }
  ]
}
```
---
### Deleting an interaction

`DELETE https://generativelanguage.googleapis.com/v1beta/interactions/{id}`

Deletes the interaction by id.

#### Parameters
- **id** (`string`) *(Required)* The unique identifier of the interaction to delete.

- **api_version** (`string`) Which version of the API to use.



#### Response

#### Examples
**Delete Interaction**

**REST**

```sh
curl -X DELETE https://generativelanguage.googleapis.com/v1beta/interactions/v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg \
  -H "x-goog-api-key: $GEMINI_API_KEY"

```
**Python**

```python
from google import genai

client = genai.Client()
client.interactions.delete(id="v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg")
print("Interaction deleted successfully.")

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
await ai.interactions.delete('v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg');
console.log('Interaction deleted successfully.');

```
---
### Canceling an interaction

`POST https://generativelanguage.googleapis.com/v1beta/interactions/{id}/cancel`

Cancels an interaction by id. This only applies to background interactions that are still running.

#### Parameters
- **id** (`string`) *(Required)* The unique identifier of the interaction to cancel.

- **api_version** (`string`) Which version of the API to use.



#### Response
Returns [Interaction](#interaction) resources.

#### Examples
**Cancel Interaction**

**REST**

```sh
curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions/v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg/cancel \
  -H "x-goog-api-key: $GEMINI_API_KEY"

```
**Python**

```python
from google import genai

client = genai.Client()

interaction = client.interactions.cancel(id="v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg")
print(interaction.status)

```
**JavaScript**

```javascript
import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.cancel('v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg');
console.log(interaction.status);

```
Response:
```json
{
  "id": "v1_ChdPU0F4YWFtNkFwS2kxZThQZ05lbXdROBIXT1NBeGFhbTZBcEtpMWU4UGdOZW13UTg",
  "agent": "deep-research-pro-preview-12-2025",
  "status": "cancelled",
  "object": "interaction",
  "created": "2025-11-26T12:25:15Z",
  "updated": "2025-11-26T12:25:15Z",
  "role": "agent"
}
```
---

## Resources
### Interaction
The Interaction resource.

**Properties:**
- **model** (`<a href="#Resource:ModelOption">ModelOption</a>`) The name of the `Model` used for generating the interaction.
 Possible values:
 - `gemini-2.5-flash`: Our first hybrid reasoning model which supports a 1M token context window and has thinking budgets. - `gemini-2.5-flash-image`: Our native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash. - `gemini-2.5-flash-lite`: Our smallest and most cost effective model, built for at scale usage. - `gemini-2.5-flash-lite-preview-09-2025`: The latest model based on Gemini 2.5 Flash lite optimized for cost-efficiency, high throughput and high quality. - `gemini-2.5-flash-native-audio-preview-12-2025`: Our native audio models optimized for higher quality audio outputs with better pacing, voice naturalness, verbosity, and mood. - `gemini-2.5-flash-preview-09-2025`: The latest model based on the 2.5 Flash model. 2.5 Flash Preview is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases. - `gemini-2.5-flash-preview-tts`: Our 2.5 Flash text-to-speech model optimized for powerful, low-latency controllable speech generation. - `gemini-2.5-pro`: Our state-of-the-art multipurpose model, which excels at coding and complex reasoning tasks. - `gemini-2.5-pro-preview-tts`: Our 2.5 Pro text-to-speech audio model optimized for powerful, low-latency speech generation for more natural outputs and easier to steer prompts. - `gemini-3-flash-preview`: Our most intelligent model built for speed, combining frontier intelligence with superior search and grounding. - `gemini-3-pro-image-preview`: State-of-the-art image generation and editing model. - `gemini-3-pro-preview`: Our most intelligent model with SOTA reasoning and multimodal understanding, and powerful agentic and vibe coding capabilities. - `gemini-3.1-pro-preview`: Our latest SOTA reasoning model with unprecedented depth and nuance, and powerful multimodal understanding and coding capabilities. - `gemini-3.1-flash-image-preview`: Pro-level visual intelligence with Flash-speed efficiency and reality-grounded generation capabilities.
- **agent** (`<a href="#Resource:AgentOption">AgentOption</a>`) The name of the `Agent` used for generating the interaction.
 Possible values:
 - `deep-research-pro-preview-12-2025`: Gemini Deep Research Agent
- **id** (`string`) *(Required)* Output only. A unique identifier for the interaction completion.

- **status** (`enum (string)`) *(Required)* Output only. The status of the interaction.
 Possible values:
 - `in_progress` - `requires_action` - `completed` - `failed` - `cancelled` - `incomplete`
- **created** (`string`) *(Required)* Output only. The time at which the response was created in ISO 8601 format (YYYY-MM-DDThh:mm:ssZ).

- **updated** (`string`) *(Required)* Output only. The time at which the response was last updated in ISO 8601 format (YYYY-MM-DDThh:mm:ssZ).

- **role** (`string`) Output only. The role of the interaction.

- **outputs** (`array (<a href="#Resource:Content">Content</a>)`) Output only. Responses from the model.

- **system_instruction** (`string`) System instruction for the interaction.

- **tools** (`array (<a href="#Resource:Tool">Tool</a>)`) A list of tool declarations the model may call during interaction.

- **usage** (`<a href="#Resource:Usage">Usage</a>`) Output only. Statistics on the interaction request's token usage.
 - **total_input_tokens** (`integer`)  Number of tokens in the prompt (context).

 - **input_tokens_by_modality** (`array (<a href="#Resource:ModalityTokens">ModalityTokens</a>)`)  A breakdown of input token usage by modality.
  - **modality** (`<a href="#Resource:ResponseModality">ResponseModality</a>`)   The modality associated with the token count.
   Possible values:
   - `text`   - `image`   - `audio`
  - **tokens** (`integer`)   Number of tokens for the modality.


 - **total_cached_tokens** (`integer`)  Number of tokens in the cached part of the prompt (the cached content).

 - **cached_tokens_by_modality** (`array (<a href="#Resource:ModalityTokens">ModalityTokens</a>)`)  A breakdown of cached token usage by modality.
  - **modality** (`<a href="#Resource:ResponseModality">ResponseModality</a>`)   The modality associated with the token count.
   Possible values:
   - `text`   - `image`   - `audio`
  - **tokens** (`integer`)   Number of tokens for the modality.


 - **total_output_tokens** (`integer`)  Total number of tokens across all the generated responses.

 - **output_tokens_by_modality** (`array (<a href="#Resource:ModalityTokens">ModalityTokens</a>)`)  A breakdown of output token usage by modality.
  - **modality** (`<a href="#Resource:ResponseModality">ResponseModality</a>`)   The modality associated with the token count.
   Possible values:
   - `text`   - `image`   - `audio`
  - **tokens** (`integer`)   Number of tokens for the modality.


 - **total_tool_use_tokens** (`integer`)  Number of tokens present in tool-use prompt(s).

 - **tool_use_tokens_by_modality** (`array (<a href="#Resource:ModalityTokens">ModalityTokens</a>)`)  A breakdown of tool-use token usage by modality.
  - **modality** (`<a href="#Resource:ResponseModality">ResponseModality</a>`)   The modality associated with the token count.
   Possible values:
   - `text`   - `image`   - `audio`
  - **tokens** (`integer`)   Number of tokens for the modality.


 - **total_thought_tokens** (`integer`)  Number of tokens of thoughts for thinking models.

 - **total_tokens** (`integer`)  Total token count for the interaction request (prompt + responses + other internal tokens).


- **response_modalities** (`array (<a href="#Resource:ResponseModality">ResponseModality</a>)`) The requested modalities of the response (TEXT, IMAGE, AUDIO).
 Possible values:
 - `text` - `image` - `audio`
- **response_format** (`object`) Enforces that the generated response is a JSON object that complies with the JSON schema specified in this field.

- **response_mime_type** (`string`) The mime type of the response. This is required if response_format is set.

- **previous_interaction_id** (`string`) The ID of the previous interaction, if any.

- **input** (`<a href="#Resource:Content">Content</a> or array (<a href="#Resource:Content">Content</a>) or array (<a href="#Resource:Turn">Turn</a>) or string`) The inputs for the interaction.

- **generation_config** (`<a href="#Resource:GenerationConfig">GenerationConfig</a>`) Input only. Configuration parameters for the model interaction.
 - **temperature** (`number`)  Controls the randomness of the output.

 - **top_p** (`number`)  The maximum cumulative probability of tokens to consider when sampling.

 - **seed** (`integer`)  Seed used in decoding for reproducibility.

 - **stop_sequences** (`array (string)`)  A list of character sequences that will stop output interaction.

 - **thinking_level** (`<a href="#Resource:ThinkingLevel">ThinkingLevel</a>`)  The level of thought tokens that the model should generate.
  Possible values:
  - `minimal`  - `low`  - `medium`  - `high`
 - **thinking_summaries** (`<a href="#Resource:ThinkingSummaries">ThinkingSummaries</a>`)  Whether to include thought summaries in the response.
  Possible values:
  - `auto`  - `none`
 - **max_output_tokens** (`integer`)  The maximum number of tokens to include in the response.

 - **speech_config** (`array (<a href="#Resource:SpeechConfig">SpeechConfig</a>)`)  Configuration for speech interaction.
  - **voice** (`string`)   The voice of the speaker.

  - **language** (`string`)   The language of the speech.

  - **speaker** (`string`)   The speaker's name, it should match the speaker name given in the prompt.


 - **image_config** (`<a href="#Resource:ImageConfig">ImageConfig</a>`)  Configuration for image interaction.
  - **aspect_ratio** (`enum (string)`)
   Possible values:
   - `1:1`   - `2:3`   - `3:2`   - `3:4`   - `4:3`   - `4:5`   - `5:4`   - `9:16`   - `16:9`   - `21:9`   - `1:8`   - `8:1`   - `1:4`   - `4:1`
  - **image_size** (`enum (string)`)
   Possible values:
   - `1K`   - `2K`   - `4K`   - `512`

 - **tool_choice** (`<a href="#Resource:ToolChoiceConfig">ToolChoiceConfig</a> or <a href="#Resource:ToolChoiceType">ToolChoiceType</a>`)  The tool choice for the interaction.


- **agent_config** (`<a href="#Resource:DeepResearchAgentConfig">DeepResearchAgentConfig</a> or <a href="#Resource:DynamicAgentConfig">DynamicAgentConfig</a>`) Configuration for the agent.
 **Possible Types:** (Discriminator: `type`) - **DynamicAgentConfig**: Configuration for dynamic agents.
  - **type** (`object`) *(Required)*
   Value: `dynamic`
 - **DeepResearchAgentConfig**: Configuration for the Deep Research agent.
  - **thinking_summaries** (`<a href="#Resource:ThinkingSummaries">ThinkingSummaries</a>`)   Whether to include thought summaries in the response.
   Possible values:
   - `auto`   - `none`
  - **type** (`object`) *(Required)*
   Value: `deep-research`


**JSON Representation:**
```json
{
  "created": "2025-12-04T15:01:45Z",
  "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
  "outputs": [
    {
      "text": "Hello! I'm doing well, functioning as expected. Thank you for asking! How are you doing today?",
      "type": "text"
    }
  ],
  "role": "model",
  "status": "completed",
  "updated": "2025-12-04T15:01:45Z",
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 7
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 7,
    "total_output_tokens": 23,
    "total_thought_tokens": 49,
    "total_tokens": 79,
    "total_tool_use_tokens": 0
  }
}
```

**Examples**
**Example**

```json
{
  "created": "2025-12-04T15:01:45Z",
  "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
  "model": "gemini-3-flash-preview",
  "object": "interaction",
  "outputs": [
    {
      "text": "Hello! I'm doing well, functioning as expected. Thank you for asking! How are you doing today?",
      "type": "text"
    }
  ],
  "role": "model",
  "status": "completed",
  "updated": "2025-12-04T15:01:45Z",
  "usage": {
    "input_tokens_by_modality": [
      {
        "modality": "text",
        "tokens": 7
      }
    ],
    "total_cached_tokens": 0,
    "total_input_tokens": 7,
    "total_output_tokens": 23,
    "total_thought_tokens": 49,
    "total_tokens": 79,
    "total_tool_use_tokens": 0
  }
}
```


## Data Models
### Content
The content of the response.

**Polymorphic Types:** (Discriminator: `type`)- **TextContent**
    - A text content block.
     - **text** (`string`) *(Required)*  The text content.

     - **annotations** (`array (<a href="#Resource:Annotation">Annotation</a>)`)  Citation information for model-generated content.
  - **start_index** (`integer`)   Start of segment of the response that is attributed to this source.  Index indicates the start of the segment, measured in bytes.

  - **end_index** (`integer`)   End of the attributed segment, exclusive.

  - **source** (`string`)   Source attributed for a portion of the text. Could be a URL, title, or other identifier.


     - **type** (`object`) *(Required)*
  Value: `text`
**Examples**
**Text**

```json
    {
  "type": "text",
  "text": "Hello, how are you?"
}
    ```
- **ImageContent**
    - An image content block.
     - **data** (`string`)  The image content.

     - **uri** (`string`)  The URI of the image.

     - **mime_type** (`enum (string)`)  The mime type of the image.
  Possible values:
  - `image/png`  - `image/jpeg`  - `image/webp`  - `image/heic`  - `image/heif`
     - **resolution** (`<a href="#Resource:MediaResolution">MediaResolution</a>`)  The resolution of the media.
  Possible values:
  - `low`  - `medium`  - `high`  - `ultra_high`
     - **type** (`object`) *(Required)*
  Value: `image`
**Examples**
**Image**

```json
    {
  "type": "image",
  "data": "BASE64_ENCODED_IMAGE",
  "mime_type": "image/png"
}
    ```
- **AudioContent**
    - An audio content block.
     - **data** (`string`)  The audio content.

     - **uri** (`string`)  The URI of the audio.

     - **mime_type** (`enum (string)`)  The mime type of the audio.
  Possible values:
  - `audio/wav`  - `audio/mp3`  - `audio/aiff`  - `audio/aac`  - `audio/ogg`  - `audio/flac`
     - **type** (`object`) *(Required)*
  Value: `audio`
**Examples**
**Audio**

```json
    {
  "type": "audio",
  "data": "BASE64_ENCODED_AUDIO",
  "mime_type": "audio/wav"
}
    ```
- **DocumentContent**
    - A document content block.
     - **data** (`string`)  The document content.

     - **uri** (`string`)  The URI of the document.

     - **mime_type** (`enum (string)`)  The mime type of the document.
  Possible values:
  - `application/pdf`
     - **type** (`object`) *(Required)*
  Value: `document`
**Examples**
**Document**

```json
    {
  "type": "document",
  "data": "BASE64_ENCODED_DOCUMENT",
  "mime_type": "application/pdf"
}
    ```
- **VideoContent**
    - A video content block.
     - **data** (`string`)  The video content.

     - **uri** (`string`)  The URI of the video.

     - **mime_type** (`enum (string)`)  The mime type of the video.
  Possible values:
  - `video/mp4`  - `video/mpeg`  - `video/mpg`  - `video/mov`  - `video/avi`  - `video/x-flv`  - `video/webm`  - `video/wmv`  - `video/3gpp`
     - **resolution** (`<a href="#Resource:MediaResolution">MediaResolution</a>`)  The resolution of the media.
  Possible values:
  - `low`  - `medium`  - `high`  - `ultra_high`
     - **type** (`object`) *(Required)*
  Value: `video`
**Examples**
**Video**

```json
    {
  "type": "video",
  "uri": "https://www.youtube.com/watch?v=9hE5-98ZeCg"
}
    ```
- **ThoughtContent**
    - A thought content block.
     - **signature** (`string`)  Signature to match the backend source to be part of the generation.

     - **summary** (`<a href="#Resource:ThoughtSummary">ThoughtSummary</a>`)  A summary of the thought.

     - **type** (`object`) *(Required)*
  Value: `thought`
**Examples**
**Thought**

```json
    {
  "type": "thought",
  "summary": [
    {
      "type": "text",
      "text": "The user is asking about the weather. I should use the get_weather tool."
    }
  ],
  "signature": "CoMDAXLI2nynRYojJIy6B1Jh9os2crpWLfB0+19xcLsGG46bd8wjkF/6RNlRUdvHrXyjsHkG0BZFcuO/bPOyA6Xh5jANNgx82wPHjGExN8A4ZQn56FlMwyZoqFVQz0QyY1lfibFJ2zU3J87uw26OewzcuVX0KEcs+GIsZa3EA6WwqhbsOd3wtZB3Ua2Qf98VAWZTS5y/tWpql7jnU3/CU7pouxQr/Bwft3hwnJNesQ9/dDJTuaQ8Zprh9VRWf1aFFjpIueOjBRrlT3oW6/y/eRl/Gt9BQXCYTqg/38vHFUU4Wo/d9dUpvfCe/a3o97t2Jgxp34oFKcsVb4S5WJrykIkw+14DzVnTpCpbQNFckqvFLuqnJCkL0EQFtunBXI03FJpPu3T1XU6id8S7ojoJQZSauGUCgmaLqUGdMrd08oo81ecoJSLs51Re9N/lISGmjWFPGpqJLoGq6uo4FHz58hmeyXCgHG742BHz2P3MiH1CXHUT2J8mF6zLhf3SR9Qb3lkrobAh"
}
    ```
- **FunctionCallContent**
    - A function tool call content block.
     - **name** (`string`) *(Required)*  The name of the tool to call.

     - **arguments** (`object`) *(Required)*  The arguments to pass to the function.

     - **type** (`object`) *(Required)*
  Value: `function_call`
     - **id** (`string`) *(Required)*  A unique ID for this specific tool call.

**Examples**
**Function Call**

```json
    {
  "type": "function_call",
  "name": "get_weather",
  "id": "gth23981",
  "arguments": {
    "location": "Boston, MA"
  }
}
    ```
- **FunctionResultContent**
    - A function tool result content block.
     - **name** (`string`)  The name of the tool that was called.

     - **is_error** (`boolean`)  Whether the tool call resulted in an error.

     - **type** (`object`) *(Required)*
  Value: `function_result`
     - **result** (`object or string`) *(Required)*  The result of the tool call.

     - **call_id** (`string`) *(Required)*  ID to match the ID from the function call block.

**Examples**
**Function Result**

```json
    {
  "type": "function_result",
  "name": "get_weather",
  "call_id": "gth23981",
  "result": [
    {
      "type": "text",
      "text": "{\"weather\":\"sunny\"}"
    }
  ]
}
    ```
- **CodeExecutionCallContent**
    - Code execution content.
     - **arguments** (`<a href="#Resource:CodeExecutionCallArguments">CodeExecutionCallArguments</a>`) *(Required)*  The arguments to pass to the code execution.
  - **language** (`enum (string)`)   Programming language of the `code`.
   Possible values:
   - `python`
  - **code** (`string`)   The code to be executed.


     - **type** (`object`) *(Required)*
  Value: `code_execution_call`
     - **id** (`string`) *(Required)*  A unique ID for this specific tool call.

**Examples**
**Code Execution Call**

```json
    {
  "type": "code_execution_call",
  "id": "call_123456",
  "arguments": {
    "language": "python",
    "code": "print('hello world')"
  }
}
    ```
- **CodeExecutionResultContent**
    - Code execution result content.
     - **result** (`string`) *(Required)*  The output of the code execution.

     - **is_error** (`boolean`)  Whether the code execution resulted in an error.

     - **signature** (`string`)  A signature hash for backend validation.

     - **type** (`object`) *(Required)*
  Value: `code_execution_result`
     - **call_id** (`string`) *(Required)*  ID to match the ID from the code execution call block.

**Examples**
**Code Execution Result**

```json
    {
  "type": "code_execution_result",
  "call_id": "call_123456",
  "result": "hello world"
}
    ```
- **UrlContextCallContent**
    - URL context content.
     - **arguments** (`<a href="#Resource:UrlContextCallArguments">UrlContextCallArguments</a>`) *(Required)*  The arguments to pass to the URL context.
  - **urls** (`array (string)`)   The URLs to fetch.


     - **type** (`object`) *(Required)*
  Value: `url_context_call`
     - **id** (`string`) *(Required)*  A unique ID for this specific tool call.

**Examples**
**Url Context Call**

```json
    {
  "type": "url_context_call",
  "id": "call_123456",
  "arguments": {
    "urls": [
      "https://www.example.com"
    ]
  }
}
    ```
- **UrlContextResultContent**
    - URL context result content.
     - **signature** (`string`)  The signature of the URL context result.

     - **result** (`array (<a href="#Resource:UrlContextResult">UrlContextResult</a>)`) *(Required)*  The results of the URL context.
  - **url** (`string`)   The URL that was fetched.

  - **status** (`enum (string)`)   The status of the URL retrieval.
   Possible values:
   - `success`   - `error`   - `paywall`   - `unsafe`

     - **is_error** (`boolean`)  Whether the URL context resulted in an error.

     - **type** (`object`) *(Required)*
  Value: `url_context_result`
     - **call_id** (`string`) *(Required)*  ID to match the ID from the url context call block.

**Examples**
**Url Context Result**

```json
    {
  "type": "url_context_result",
  "call_id": "call_123456",
  "result": [
    {
      "url": "https://www.example.com",
      "status": "SUCCESS"
    }
  ]
}
    ```
- **GoogleSearchCallContent**
    - Google Search content.
     - **arguments** (`<a href="#Resource:GoogleSearchCallArguments">GoogleSearchCallArguments</a>`) *(Required)*  The arguments to pass to Google Search.
  - **queries** (`array (string)`)   Web search queries for the following-up web search.


     - **search_type** (`enum (string)`)  The type of search grounding enabled.
  Possible values:
  - `web_search`  - `image_search`
     - **type** (`object`) *(Required)*
  Value: `google_search_call`
     - **id** (`string`) *(Required)*  A unique ID for this specific tool call.

**Examples**
**Google Search Call**

```json
    {
  "type": "google_search_call",
  "id": "call_123456",
  "arguments": {
    "queries": [
      "weather in Boston"
    ]
  }
}
    ```
- **GoogleSearchResultContent**
    - Google Search result content.
     - **signature** (`string`)  The signature of the Google Search result.

     - **result** (`array (<a href="#Resource:GoogleSearchResult">GoogleSearchResult</a>)`) *(Required)*  The results of the Google Search.
  - **url** (`string`)   URI reference of the search result.

  - **title** (`string`)   Title of the search result.

  - **rendered_content** (`string`)   Web content snippet that can be embedded in a web page or an app webview.


     - **is_error** (`boolean`)  Whether the Google Search resulted in an error.

     - **type** (`object`) *(Required)*
  Value: `google_search_result`
     - **call_id** (`string`) *(Required)*  ID to match the ID from the google search call block.

**Examples**
**Google Search Result**

```json
    {
  "type": "google_search_result",
  "call_id": "call_123456",
  "result": [
    {
      "url": "https://www.google.com/search?q=weather+in+Boston",
      "title": "Weather in Boston"
    }
  ]
}
    ```
- **McpServerToolCallContent**
    - MCPServer tool call content.
     - **name** (`string`) *(Required)*  The name of the tool which was called.

     - **server_name** (`string`) *(Required)*  The name of the used MCP server.

     - **arguments** (`object`) *(Required)*  The JSON object of arguments for the function.

     - **type** (`object`) *(Required)*
  Value: `mcp_server_tool_call`
     - **id** (`string`) *(Required)*  A unique ID for this specific tool call.

**Examples**
**Mcp Server Tool Call**

```json
    {
  "type": "mcp_server_tool_call",
  "id": "call_123456",
  "name": "get_forecast",
  "server_name": "weather_server",
  "arguments": {
    "city": "London"
  }
}
    ```
- **McpServerToolResultContent**
    - MCPServer tool result content.
     - **name** (`string`)  Name of the tool which is called for this specific tool call.

     - **server_name** (`string`)  The name of the used MCP server.

     - **type** (`object`) *(Required)*
  Value: `mcp_server_tool_result`
     - **result** (`object or string`) *(Required)*  The result of the tool call.

     - **call_id** (`string`) *(Required)*  ID to match the ID from the MCP server tool call block.

**Examples**
**Mcp Server Tool Result**

```json
    {
  "type": "mcp_server_tool_result",
  "name": "get_forecast",
  "server_name": "weather_server",
  "call_id": "call_123456",
  "result": "sunny"
}
    ```
- **FileSearchCallContent**
    - File Search content.
     - **type** (`object`) *(Required)*
  Value: `file_search_call`
     - **id** (`string`) *(Required)*  A unique ID for this specific tool call.

**Examples**
**File Search Call**

```json
    {
  "type": "file_search_call",
  "id": "call_123456"
}
    ```
- **FileSearchResultContent**
    - File Search result content.
     - **result** (`array (<a href="#Resource:FileSearchResult">FileSearchResult</a>)`)  The results of the File Search.
  - **title** (`string`)   The title of the search result.

  - **text** (`string`)   The text of the search result.

  - **file_search_store** (`string`)   The name of the file search store.


     - **type** (`object`) *(Required)*
  Value: `file_search_result`
     - **call_id** (`string`) *(Required)*  ID to match the ID from the file search call block.

**Examples**
**File Search Result**

```json
    {
  "type": "file_search_result",
  "call_id": "call_123456",
  "result": [
    {
      "text": "search result chunk",
      "file_search_store": "file_search_store"
    }
  ]
}
    ```

**JSON Representation:**
```json
{
  "text": "string",
  "annotations": [
    {
      "start_index": 0,
      "end_index": 0,
      "source": "string"
    }
  ],
  "type": {}
}
```


### Tool


**Polymorphic Types:** (Discriminator: `type`)- **Function**
    - A tool that can be used by the model.
     - **name** (`string`)  The name of the function.

     - **description** (`string`)  A description of the function.

     - **parameters** (`object`)  The JSON Schema for the function's parameters.

     - **type** (`string`) *(Required)*
  Value: `function`
**Examples**
**function_calling**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "function",
      "name": "get_weather",
      "description": "Get the current weather in a given location",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "The city and state, e.g. San Francisco, CA"
          }
        },
        "required": ["location"]
      }
    }],
    "input": "What is the weather like in Boston, MA?"
  }'

    ```
**function_calling**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA"
                }
            },
            "required": ["location"]
        }
    }],
    input="What is the weather like in Boston?"
)
print(response.outputs[0])

    ```
**function_calling**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'function',
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA'
                }
            },
            required: ['location']
        }
    }],
    input: 'What is the weather like in Boston?'
});
console.log(interaction.outputs[0]);

    ```
- **GoogleSearch**
    - A tool that can be used by the model to search Google.
     - **search_types** (`array (enum (string))`)  The types of search grounding to enable.
  Possible values:
  - `web_search`  - `image_search`
     - **type** (`string`) *(Required)*
  Value: `google_search`
**Examples**
**google_search**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "google_search"
    }],
    "input": "Who is the current president of France?"
  }'

    ```
**google_search**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{"type": "google_search"}],
    input="Who is the current president of France?"
)
print(response.outputs[0])

    ```
**google_search**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{ type: 'google_search' }],
    input: 'Who is the current president of France?'
});
console.log(interaction.outputs[0]);

    ```
- **CodeExecution**
    - A tool that can be used by the model to execute code.
     - **type** (`string`) *(Required)*
  Value: `code_execution`
**Examples**
**code_execution**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "code_execution"
    }],
    "input": "Calculate the first 10 Fibonacci numbers"
  }'

    ```
**code_execution**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{"type": "code_execution"}],
    input="Calculate the first 10 Fibonacci numbers"
)
print(response.outputs[0])

    ```
**code_execution**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{ type: 'code_execution' }],
    input: 'Calculate the first 10 Fibonacci numbers'
});
console.log(interaction.outputs[0]);

    ```
- **UrlContext**
    - A tool that can be used by the model to fetch URL context.
     - **type** (`string`) *(Required)*
  Value: `url_context`
**Examples**
**url_context**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "url_context"
    }],
    "input": "Summarize https://www.example.com"
  }'

    ```
**url_context**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{"type": "url_context"}],
    input="Summarize https://www.example.com"
)
print(response.outputs[0])

    ```
**url_context**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{ type: 'url_context' }],
    input: 'Summarize https://www.example.com'
});
console.log(interaction.outputs[0]);

    ```
- **ComputerUse**
    - A tool that can be used by the model to interact with the computer.
     - **environment** (`enum (string)`)  The environment being operated.
  Possible values:
  - `browser`
     - **excludedPredefinedFunctions** (`array (string)`)  The list of predefined functions that are excluded from the model call.

     - **type** (`string`) *(Required)*
  Value: `computer_use`
**Examples**
**computer_use**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-computer-use-preview-10-2025",
    "tools": [{
      "type": "computer_use",
    }],
    "input": "Find a flight to Tokyo"
  }'

    ```
**computer_use**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-2.5-computer-use-preview-10-2025",
    tools=[{"type": "computer_use"}],
    input="Find a flight to Tokyo"
)
print(response.outputs[0])

    ```
**computer_use**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-2.5-computer-use-preview-10-2025',
    tools: [{ type: 'computer_use'}],
    input: 'Find a flight to Tokyo'
});
console.log(interaction.outputs[0]);

    ```
- **McpServer**
    - A MCPServer is a server that can be called by the model to perform actions.
     - **name** (`string`)  The name of the MCPServer.

     - **url** (`string`)  The full URL for the MCPServer endpoint. Example: "https://api.example.com/mcp"

     - **headers** (`object`)  Optional: Fields for authentication headers, timeouts, etc., if needed.

     - **allowed_tools** (`array (<a href="#Resource:AllowedTools">AllowedTools</a>)`)  The allowed tools.
  - **mode** (`<a href="#Resource:ToolChoiceType">ToolChoiceType</a>`)   The mode of the tool choice.
   Possible values:
   - `auto`   - `any`   - `none`   - `validated`
  - **tools** (`array (string)`)   The names of the allowed tools.


     - **type** (`string`) *(Required)*
  Value: `mcp_server`
**Examples**
**mcp_server**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "mcp_server",
      "name": "weather_service",
      "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
    }],
    "input": "Today is 12-05-2025, what is the temperature today in London?"
  }'

    ```
**mcp_server**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "mcp_server",
        "name": "weather_service",
        "url": "https://gemini-api-demos.uc.r.appspot.com/mcp"
    }],
    input="Today is 12-05-2025, what is the temperature today in London?"
)
print(response.outputs[0])

    ```
**mcp_server**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'mcp_server',
        name: 'weather_service',
        url: 'https://gemini-api-demos.uc.r.appspot.com/mcp'
    }],
    input: 'Today is 12-05-2025, what is the temperature today in London?'
});
console.log(interaction.outputs[0]);

    ```
- **FileSearch**
    - A tool that can be used by the model to search files.
     - **file_search_store_names** (`array (string)`)  The file search store names to search.

     - **top_k** (`integer`)  The number of semantic retrieval chunks to retrieve.

     - **metadata_filter** (`string`)  Metadata filter to apply to the semantic retrieval documents and chunks.

     - **type** (`string`) *(Required)*
  Value: `file_search`
**Examples**
**file_search**

    ```sh
    curl -X POST https://generativelanguage.googleapis.com/v1beta/interactions \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-flash-preview",
    "tools": [{
      "type": "file_search",
      "file_search_store_names": ["fileSearchStores/m64d1sevsr4y-xfyawui3fxqg"]
    }],
    "input": "Who is the author of the book?"
  }'

    ```
**file_search**

    ```python
    from google import genai

client = genai.Client()
response = client.interactions.create(
    model="gemini-3-flash-preview",
    tools=[{
        "type": "file_search",
        "file_search_store_names": ["fileSearchStores/m64d1sevsr4y-xfyawui3fxqg"]
    }],
    input="Who is the author of the book?"
)
print(response.outputs[0])

    ```
**file_search**

    ```javascript
    import {GoogleGenAI} from '@google/genai';

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
    model: 'gemini-3-flash-preview',
    tools: [{
        type: 'file_search',
        file_search_store_names: ['fileSearchStores/m64d1sevsr4y-xfyawui3fxqg']
    }],
    input: 'Who is the author of the book?'
});
console.log(interaction.outputs[0]);

    ```

**JSON Representation:**
```json
{
  "name": "string",
  "description": "string",
  "parameters": {},
  "type": "function"
}
```


### Turn


**Properties:**
- **role** (`string`) The originator of this turn. Must be user for input or model for model output.

- **content** (`array (<a href="#Resource:Content">Content</a>) or string`) The content of the turn.


**JSON Representation:**
```json
{
  "role": "string",
  "content": "string"
}
```

**Examples**
**User Turn**

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "user turn"
    }
  ]
}
```
**Model Turn**

```json
{
  "role": "model",
  "content": [
    {
      "type": "text",
      "text": "model turn"
    }
  ]
}
```

### InteractionSseEvent


**Polymorphic Types:** (Discriminator: `event_type`)- **InteractionStartEvent**
    -
     - **interaction** (`<a href="#Resource:Interaction">Interaction</a>`) *(Required)*

     - **event_type** (`enum (string)`) *(Required)*
  Possible values:
  - `interaction.start`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

**Examples**
**Interaction Start**

```json
    {
  "event_type": "interaction.start",
  "interaction": {
    "id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
    "model": "gemini-3-flash-preview",
    "object": "interaction",
    "status": "in_progress"
  }
}
    ```
- **InteractionCompleteEvent**
    -
     - **interaction** (`<a href="#Resource:Interaction">Interaction</a>`) *(Required)*  The completed interaction with empty outputs to reduce the payload size. Use the preceding ContentDelta events for the actual output.

     - **event_type** (`enum (string)`) *(Required)*
  Possible values:
  - `interaction.complete`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

**Examples**
**Interaction Complete**

```json
    {
  "event_type": "interaction.complete",
  "interaction": {
    "created": "2025-12-09T18:45:40Z",
    "id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
    "model": "gemini-3-flash-preview",
    "object": "interaction",
    "role": "model",
    "status": "completed",
    "updated": "2025-12-09T18:45:40Z",
    "usage": {
      "input_tokens_by_modality": [
        {
          "modality": "text",
          "tokens": 11
        }
      ],
      "total_cached_tokens": 0,
      "total_input_tokens": 11,
      "total_output_tokens": 364,
      "total_thought_tokens": 1120,
      "total_tokens": 1495,
      "total_tool_use_tokens": 0
    }
  }
}
    ```
- **InteractionStatusUpdate**
    -
     - **interaction_id** (`string`) *(Required)*

     - **status** (`enum (string)`) *(Required)*
  Possible values:
  - `in_progress`  - `requires_action`  - `completed`  - `failed`  - `cancelled`  - `incomplete`
     - **event_type** (`string`) *(Required)*
  Value: `interaction.status_update`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

**Examples**
**Interaction Status Update**

```json
    {
  "event_type": "interaction.status_update",
  "interaction_id": "v1_ChdTMjQ0YWJ5TUF1TzcxZThQdjRpcnFRcxIXUzI0NGFieU1BdU83MWU4UHY0aXJxUXM",
  "status": "in_progress"
}
    ```
- **ContentStart**
    -
     - **index** (`integer`) *(Required)*

     - **content** (`<a href="#Resource:Content">Content</a>`) *(Required)*

     - **event_type** (`string`) *(Required)*
  Value: `content.start`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

**Examples**
**Content Start**

```json
    {
  "event_type": "content.start",
  "content": {
    "type": "text"
  },
  "index": 1
}
    ```
- **ContentDelta**
    -
     - **index** (`integer`) *(Required)*

     - **event_type** (`string`) *(Required)*
  Value: `content.delta`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

     - **delta** (`<a href="#Resource:AudioDelta">AudioDelta</a> or <a href="#Resource:CodeExecutionCallDelta">CodeExecutionCallDelta</a> or <a href="#Resource:CodeExecutionResultDelta">CodeExecutionResultDelta</a> or <a href="#Resource:DocumentDelta">DocumentDelta</a> or <a href="#Resource:FileSearchCallDelta">FileSearchCallDelta</a> or <a href="#Resource:FileSearchResultDelta">FileSearchResultDelta</a> or <a href="#Resource:FunctionCallDelta">FunctionCallDelta</a> or <a href="#Resource:FunctionResultDelta">FunctionResultDelta</a> or <a href="#Resource:GoogleSearchCallDelta">GoogleSearchCallDelta</a> or <a href="#Resource:GoogleSearchResultDelta">GoogleSearchResultDelta</a> or <a href="#Resource:ImageDelta">ImageDelta</a> or <a href="#Resource:McpServerToolCallDelta">McpServerToolCallDelta</a> or <a href="#Resource:McpServerToolResultDelta">McpServerToolResultDelta</a> or <a href="#Resource:TextDelta">TextDelta</a> or <a href="#Resource:ThoughtSignatureDelta">ThoughtSignatureDelta</a> or <a href="#Resource:ThoughtSummaryDelta">ThoughtSummaryDelta</a> or <a href="#Resource:UrlContextCallDelta">UrlContextCallDelta</a> or <a href="#Resource:UrlContextResultDelta">UrlContextResultDelta</a> or <a href="#Resource:VideoDelta">VideoDelta</a>`) *(Required)*
  **Possible Types:** (Discriminator: `type`)  - **TextDelta**:
   - **text** (`string`) *(Required)*

   - **annotations** (`array (<a href="#Resource:Annotation">Annotation</a>)`)    Citation information for model-generated content.
    - **start_index** (`integer`)     Start of segment of the response that is attributed to this source.  Index indicates the start of the segment, measured in bytes.

    - **end_index** (`integer`)     End of the attributed segment, exclusive.

    - **source** (`string`)     Source attributed for a portion of the text. Could be a URL, title, or other identifier.


   - **type** (`object`) *(Required)*
    Value: `text`
  - **ImageDelta**:
   - **data** (`string`)

   - **uri** (`string`)

   - **mime_type** (`enum (string)`)
    Possible values:
    - `image/png`    - `image/jpeg`    - `image/webp`    - `image/heic`    - `image/heif`
   - **resolution** (`<a href="#Resource:MediaResolution">MediaResolution</a>`)    The resolution of the media.
    Possible values:
    - `low`    - `medium`    - `high`    - `ultra_high`
   - **type** (`object`) *(Required)*
    Value: `image`
  - **AudioDelta**:
   - **data** (`string`)

   - **uri** (`string`)

   - **mime_type** (`enum (string)`)
    Possible values:
    - `audio/wav`    - `audio/mp3`    - `audio/aiff`    - `audio/aac`    - `audio/ogg`    - `audio/flac`
   - **type** (`object`) *(Required)*
    Value: `audio`
  - **DocumentDelta**:
   - **data** (`string`)

   - **uri** (`string`)

   - **mime_type** (`enum (string)`)
    Possible values:
    - `application/pdf`
   - **type** (`object`) *(Required)*
    Value: `document`
  - **VideoDelta**:
   - **data** (`string`)

   - **uri** (`string`)

   - **mime_type** (`enum (string)`)
    Possible values:
    - `video/mp4`    - `video/mpeg`    - `video/mpg`    - `video/mov`    - `video/avi`    - `video/x-flv`    - `video/webm`    - `video/wmv`    - `video/3gpp`
   - **resolution** (`<a href="#Resource:MediaResolution">MediaResolution</a>`)    The resolution of the media.
    Possible values:
    - `low`    - `medium`    - `high`    - `ultra_high`
   - **type** (`object`) *(Required)*
    Value: `video`
  - **ThoughtSummaryDelta**:
   - **type** (`object`) *(Required)*
    Value: `thought_summary`
   - **content** (`<a href="#Resource:ImageContent">ImageContent</a> or <a href="#Resource:TextContent">TextContent</a>`)
    **Possible Types:** (Discriminator: `type`)    - **TextContent**: A text content block.
     - **text** (`string`) *(Required)*      The text content.

     - **annotations** (`array (<a href="#Resource:Annotation">Annotation</a>)`)      Citation information for model-generated content.
      - **start_index** (`integer`)       Start of segment of the response that is attributed to this source.  Index indicates the start of the segment, measured in bytes.

      - **end_index** (`integer`)       End of the attributed segment, exclusive.

      - **source** (`string`)       Source attributed for a portion of the text. Could be a URL, title, or other identifier.


     - **type** (`object`) *(Required)*
      Value: `text`
    - **ImageContent**: An image content block.
     - **data** (`string`)      The image content.

     - **uri** (`string`)      The URI of the image.

     - **mime_type** (`enum (string)`)      The mime type of the image.
      Possible values:
      - `image/png`      - `image/jpeg`      - `image/webp`      - `image/heic`      - `image/heif`
     - **resolution** (`<a href="#Resource:MediaResolution">MediaResolution</a>`)      The resolution of the media.
      Possible values:
      - `low`      - `medium`      - `high`      - `ultra_high`
     - **type** (`object`) *(Required)*
      Value: `image`

  - **ThoughtSignatureDelta**:
   - **signature** (`string`)    Signature to match the backend source to be part of the generation.

   - **type** (`object`) *(Required)*
    Value: `thought_signature`
  - **FunctionCallDelta**:
   - **name** (`string`) *(Required)*

   - **arguments** (`object`) *(Required)*

   - **type** (`object`) *(Required)*
    Value: `function_call`
   - **id** (`string`) *(Required)*    A unique ID for this specific tool call.

  - **FunctionResultDelta**:
   - **name** (`string`)

   - **is_error** (`boolean`)

   - **type** (`object`) *(Required)*
    Value: `function_result`
   - **result** (`object or string`) *(Required)*    Tool call result delta.

   - **call_id** (`string`) *(Required)*    ID to match the ID from the function call block.

  - **CodeExecutionCallDelta**:
   - **arguments** (`<a href="#Resource:CodeExecutionCallArguments">CodeExecutionCallArguments</a>`) *(Required)*
    - **language** (`enum (string)`)     Programming language of the `code`.
     Possible values:
     - `python`
    - **code** (`string`)     The code to be executed.


   - **type** (`object`) *(Required)*
    Value: `code_execution_call`
   - **id** (`string`) *(Required)*    A unique ID for this specific tool call.

  - **CodeExecutionResultDelta**:
   - **result** (`string`) *(Required)*

   - **is_error** (`boolean`)

   - **signature** (`string`)

   - **type** (`object`) *(Required)*
    Value: `code_execution_result`
   - **call_id** (`string`) *(Required)*    ID to match the ID from the function call block.

  - **UrlContextCallDelta**:
   - **arguments** (`<a href="#Resource:UrlContextCallArguments">UrlContextCallArguments</a>`) *(Required)*
    - **urls** (`array (string)`)     The URLs to fetch.


   - **type** (`object`) *(Required)*
    Value: `url_context_call`
   - **id** (`string`) *(Required)*    A unique ID for this specific tool call.

  - **UrlContextResultDelta**:
   - **signature** (`string`)

   - **result** (`array (<a href="#Resource:UrlContextResult">UrlContextResult</a>)`) *(Required)*
    - **url** (`string`)     The URL that was fetched.

    - **status** (`enum (string)`)     The status of the URL retrieval.
     Possible values:
     - `success`     - `error`     - `paywall`     - `unsafe`

   - **is_error** (`boolean`)

   - **type** (`object`) *(Required)*
    Value: `url_context_result`
   - **call_id** (`string`) *(Required)*    ID to match the ID from the function call block.

  - **GoogleSearchCallDelta**:
   - **arguments** (`<a href="#Resource:GoogleSearchCallArguments">GoogleSearchCallArguments</a>`) *(Required)*
    - **queries** (`array (string)`)     Web search queries for the following-up web search.


   - **type** (`object`) *(Required)*
    Value: `google_search_call`
   - **id** (`string`) *(Required)*    A unique ID for this specific tool call.

  - **GoogleSearchResultDelta**:
   - **signature** (`string`)

   - **result** (`array (<a href="#Resource:GoogleSearchResult">GoogleSearchResult</a>)`) *(Required)*
    - **url** (`string`)     URI reference of the search result.

    - **title** (`string`)     Title of the search result.

    - **rendered_content** (`string`)     Web content snippet that can be embedded in a web page or an app webview.


   - **is_error** (`boolean`)

   - **type** (`object`) *(Required)*
    Value: `google_search_result`
   - **call_id** (`string`) *(Required)*    ID to match the ID from the function call block.

  - **McpServerToolCallDelta**:
   - **name** (`string`) *(Required)*

   - **server_name** (`string`) *(Required)*

   - **arguments** (`object`) *(Required)*

   - **type** (`object`) *(Required)*
    Value: `mcp_server_tool_call`
   - **id** (`string`) *(Required)*    A unique ID for this specific tool call.

  - **McpServerToolResultDelta**:
   - **name** (`string`)

   - **server_name** (`string`)

   - **type** (`object`) *(Required)*
    Value: `mcp_server_tool_result`
   - **result** (`object or string`) *(Required)*    Tool call result delta.

   - **call_id** (`string`) *(Required)*    ID to match the ID from the function call block.

  - **FileSearchCallDelta**:
   - **type** (`object`) *(Required)*
    Value: `file_search_call`
   - **id** (`string`) *(Required)*    A unique ID for this specific tool call.

  - **FileSearchResultDelta**:
   - **result** (`array (<a href="#Resource:FileSearchResult">FileSearchResult</a>)`)
    - **title** (`string`)     The title of the search result.

    - **text** (`string`)     The text of the search result.

    - **file_search_store** (`string`)     The name of the file search store.


   - **type** (`object`) *(Required)*
    Value: `file_search_result`

**Examples**
**Content Delta**

```json
    {
  "event_type": "content.delta",
  "delta": {
    "type": "text",
    "text": "Elara\u2019s life was a symphony of quiet moments. A librarian, she found solace in the hushed aisles, the scent of aged paper, and the predictable rhythm of her days. Her small apartment, meticulously ordered, reflected this internal calm, save"
  },
  "index": 1
}
    ```
- **ContentStop**
    -
     - **index** (`integer`) *(Required)*

     - **event_type** (`string`) *(Required)*
  Value: `content.stop`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

**Examples**
**Content Stop**

```json
    {
  "event_type": "content.stop",
  "index": 1
}
    ```
- **ErrorEvent**
    -
     - **error** (`<a href="#Resource:Error">Error</a>`)
  - **code** (`string`)   A URI that identifies the error type.

  - **message** (`string`)   A human-readable error message.


     - **event_type** (`string`) *(Required)*
  Value: `error`
     - **event_id** (`string`)  The event_id token to be used to resume the interaction stream, from this event.

**Examples**
**Error Event**

```json
    {
  "event_type": "error",
  "error": {
    "message": "Failed to get completed interaction: Result not found.",
    "code": "not_found"
  }
}
    ```

**JSON Representation:**
```json
{
  "interaction": {
    "created": "2025-12-04T15:01:45Z",
    "id": "v1_ChdXS0l4YWZXTk9xbk0xZThQczhEcmlROBIXV0tJeGFmV05PcW5NMWU4UHM4RHJpUTg",
    "model": "gemini-3-flash-preview",
    "object": "interaction",
    "outputs": [
      {
        "text": "Hello! I'm doing well, functioning as expected. Thank you for asking! How are you doing today?",
        "type": "text"
      }
    ],
    "role": "model",
    "status": "completed",
    "updated": "2025-12-04T15:01:45Z",
    "usage": {
      "input_tokens_by_modality": [
        {
          "modality": "text",
          "tokens": 7
        }
      ],
      "total_cached_tokens": 0,
      "total_input_tokens": 7,
      "total_output_tokens": 23,
      "total_thought_tokens": 49,
      "total_tokens": 79,
      "total_tool_use_tokens": 0
    }
  },
  "event_type": "interaction.start",
  "event_id": "string"
}
```


