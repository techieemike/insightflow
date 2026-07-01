import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcrypt', 'jsonwebtoken', '@google/generative-ai', 'csv-parse', 'xlsx', 'exceljs', 'json2csv', 'mammoth', 'pdf-parse', 'docx', 'sharp'],
};

export default nextConfig;
