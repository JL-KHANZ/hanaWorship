import ImageKit from "imagekit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { fileIds } = await req.json();

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return NextResponse.json({ error: "Missing fileIds" }, { status: 400 });
        }

        const imagekit = new ImageKit({
            publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "",
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
            urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "",
        });

        // ImageKit deleteFiles takes an array of fileIds
        const result = await imagekit.bulkDeleteFiles(fileIds);

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("ImageKit Delete Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
