/** Static export: the whole site is plain files, so it can be hosted free (GitHub Pages) or opened anywhere. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
/** @type {import('next').NextConfig} */
export default { output: "export", basePath, assetPrefix: basePath || undefined, images: { unoptimized: true }, trailingSlash: true, reactStrictMode: true, poweredByHeader: false };
