// ============================================================
// 文件解码器 — 处理 Base64 编码的二进制文件（PDF/Word）
// 前端将二进制文件编码为 `__BASE64__:<data>` 格式
// 此模块负责检测并解码为纯文本
// ============================================================

/**
 * 检测并解码 Base64 编码的文件内容
 * 如果内容以 __BASE64__: 开头，根据文件扩展名选择解析器
 * 否则原样返回文本内容
 */
export async function decodeFileContent(content: string, filePath: string): Promise<string> {
  if (!content.startsWith('__BASE64__:')) {
    return content;
  }

  const base64Data = content.slice('__BASE64__:'.length);
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = filePath.toLowerCase().split('.').pop();

  try {
    if (ext === 'pdf') {
      return await extractPdfText(buffer);
    } else if (ext === 'docx' || ext === 'doc') {
      return await extractDocxText(buffer);
    }
  } catch (e) {
    console.warn(`[file-decoder] Failed to decode ${filePath}:`, (e as Error).message);
  }

  // 解码失败时返回空字符串，避免乱码污染分析
  return '';
}

/**
 * 从 PDF Buffer 中提取文本
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Use require for CommonJS interop — pdf-parse exports differently in ESM vs CJS
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text || '';
}

/**
 * 从 DOCX Buffer 中提取文本
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  // mammoth 提取纯文本
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * 批量解码文件列表
 */
export async function decodeFiles(files: { path: string; content: string }[]): Promise<{ path: string; content: string }[]> {
  const decoded: { path: string; content: string }[] = [];
  for (const f of files) {
    const content = await decodeFileContent(f.content, f.path);
    // 跳过解码失败的空文件
    if (content.trim().length > 0) {
      decoded.push({ path: f.path, content });
    }
  }
  return decoded;
}
