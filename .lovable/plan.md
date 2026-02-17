

# Make AI Chat Support Document Uploads for ICP Creation

## Current State

Your app has **two AI assistants**:
1. **LaunchPulse AI** (Cmd+K, floating chat button) -- The full-featured one with action execution, ICP creation, search, analytics, etc. This one CAN create ICPs when you ask it to.
2. **AI Assistant** (Cmd+J) -- A simpler Q&A chatbot with no action execution.

The screenshot you shared shows the LaunchPulse AI (Cmd+K) chat. **ICP creation already works** if you type something like "Create an ICP for enterprise tech companies in the US with CTOs." The AI will generate a create_icp action, show a confirmation dialog, and create the ICP upon approval.

However, **document upload is not supported** in the chat. The `parse-icp-document` function exists but is only used during onboarding. This plan adds document upload to the LaunchPulse AI chat.

## What Will Change

### 1. Add a file upload button to the chat input area
- Add a paperclip/upload icon button next to the text input in `AIChat.tsx`
- Support PDF, DOCX, TXT, and CSV files (up to 10MB)
- Show the attached file name as a chip/badge above the input

### 2. Client-side document text extraction
- For PDFs: Use the existing `pdfjs-dist` dependency to extract text client-side (already installed)
- For TXT/CSV: Read as plain text via FileReader
- For DOCX: Add basic text extraction or use the AI to interpret the raw content

### 3. Wire document text into the AI chat flow
- When a document is attached, extract its text and prepend it to the user's message as context
- The system prompt already has `create_icp` instructions, so if the user says "Create an ICP from this document", the AI will parse the content and generate a `create_icp` action
- Alternatively, if the user attaches a document without a message, auto-send: "Create an ICP profile from this document"

### 4. Add a dedicated "Upload ICP Document" path
- When a document is detected, also offer to use the specialized `parse-icp-document` edge function directly (which uses structured tool calling for better extraction accuracy)
- Show a choice: "Quick parse with AI" vs "Deep ICP extraction"

## Files to Change

- **`src/components/AIChat.tsx`** -- Add file upload button, file preview chip, and upload handling logic
- **`src/hooks/use-ai-chat.tsx`** -- Add `sendMessageWithDocument` method that includes extracted document text
- **`src/lib/document-utils.ts`** (new) -- PDF/TXT text extraction utilities using pdfjs-dist

## Technical Details

### File upload UI addition (AIChat.tsx)
```text
[paperclip icon] [text input...............] [send]
             [attached-file.pdf  x]           
```

### Document text extraction flow
```text
User attaches file
  -> If PDF: use pdfjs-dist getDocument() to extract text from all pages
  -> If TXT/CSV: FileReader.readAsText()
  -> If DOCX: basic extraction or send raw to AI
  -> Extracted text is prepended to the user message
  -> AI processes and generates create_icp action if appropriate
```

### Fallback to parse-icp-document
For better structured extraction, optionally call the existing `parse-icp-document` edge function directly, which uses Gemini tool calling to return a properly structured ICP profile.
