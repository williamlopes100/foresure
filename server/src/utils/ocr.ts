import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Extract all text from this image. Return ONLY the extracted text, exactly as it appears in the image, preserving formatting and line breaks. Do not add any explanations or comments.',
            },
          ],
        },
      ],
    });

    const textContent = message.content.find(block => block.type === 'text');
    return textContent && textContent.type === 'text' ? textContent.text : '';
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
