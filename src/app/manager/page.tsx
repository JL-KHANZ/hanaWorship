"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./manager.module.css";
import { IKContext, IKUpload } from "imagekitio-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { FaQuestionCircle, FaTimes } from "react-icons/fa";

const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

export default function ManagerPage() {
    const { user, isManager, loading } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        songName: "",
        songKey: "C",
        songCategory: "상향",
        songArtist: "",
        songArrangedBy: "",
        songBpm: "",
    });
    const [uploading, setUploading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [success, setSuccess] = useState("");
    const [uploadedImage, setUploadedImage] = useState<any>(null);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (!isManager) {
                router.push("/dashboard");
            }
        }
    }, [user, isManager, loading, router]);

    // Prevent flash of content
    if (loading || !isManager) return <div className="p-8 text-center text-white">권한 확인 중...</div>;

    const handleChange = (e: any) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const onSuccess = (res: any) => {
        setUploading(false);
        setUploadedImage(res);
    };

    const onError = (err: any) => {
        setUploading(false);
        console.error("Upload Error", err);
        alert("업로드 실패. 콘솔을 확인하세요.");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadedImage) {
            alert("이미지를 먼저 업로드해주세요");
            return;
        }

        try {
            // Check for duplicates
            const q = query(
                collection(db, "music_sheets"),
                where("songName", "==", formData.songName),
                where("songKey", "==", formData.songKey),
                where("songArtist", "==", formData.songArtist),
                where("songArrangedBy", "==", formData.songArrangedBy)
            );
            const duplicateSnap = await getDocs(q);

            if (!duplicateSnap.empty) {
                alert("이미 존재하는 악보입니다.");
                return;
            }

            await addDoc(collection(db, "music_sheets"), {
                ...formData,
                songCategory: formData.songCategory.split(",").map(s => s.trim()),
                imageUrl: uploadedImage.url,
                thumbnailUrl: uploadedImage.thumbnailUrl || uploadedImage.url,
                filePath: uploadedImage.filePath,
                uploadedBy: user?.uid,
                createdAt: serverTimestamp(),
            });
            setSuccess("악보가 성공적으로 등록되었습니다!");
            setFormData({
                songName: "",
                songKey: "C",
                songCategory: "상향",
                songArtist: "",
                songArrangedBy: "",
                songBpm: "",
            });
            setUploadedImage(null);
        } catch (error) {
            console.error("Error saving doc", error);
            alert("저장에 실패했습니다.");
        }
    };

    const authenticator = async () => {
        try {
            const response = await fetch("/api/imagekit/auth");
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Request failed with status ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            const { signature, expire, token } = data;
            return { signature, expire, token };
        } catch (error: any) {
            throw new Error(`Authentication request failed: ${error.message}`);
        }
    };

    return (
        <div className={styles.container}>
            <h1 className={`${styles.title} premium-gradient`}>악보 등록하기</h1>

            {success && <div className={styles.successMessage}>{success}</div>}

            <div className={`${styles.panel} glass-panel`}>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label className={styles.label}>곡 제목</label>
                        <input name="songName" required value={formData.songName} onChange={handleChange} className={styles.input} placeholder="예: 은혜 아니면" />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>Key</label>
                            <select name="songKey" value={formData.songKey} onChange={handleChange} className={styles.input}>
                                {["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <div className={styles.labelRow}>
                                <label className={styles.label}>카테고리</label>
                                <button type="button" onClick={() => setShowHelp(true)} className={styles.helpBtn} title="카테고리 설명 보기">
                                    <FaQuestionCircle />
                                </button>
                            </div>
                            <select name="songCategory" value={formData.songCategory} onChange={handleChange} className={styles.input}>
                                <option value="상향">상향</option>
                                <option value="외향">외향</option>
                                <option value="내향">내향</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>BPM (템포)</label>
                        <input
                            type="number"
                            name="songBpm"
                            value={formData.songBpm}
                            onChange={handleChange}
                            className={styles.input}
                            placeholder="예: 72"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>아티스트</label>
                        <input name="songArtist" value={formData.songArtist} onChange={handleChange} className={styles.input} placeholder="예: 어노인팅" />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>편곡자</label>
                        <input name="songArrangedBy" value={formData.songArrangedBy} onChange={handleChange} className={styles.input} placeholder="선택사항" />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>악보 이미지</label>
                        <div className={styles.uploadArea}>
                            {publicKey && urlEndpoint ? (
                                <IKContext
                                    publicKey={publicKey}
                                    urlEndpoint={urlEndpoint}
                                    authenticator={authenticator}
                                >
                                    <IKUpload
                                        fileName="music-sheet"
                                        onError={onError}
                                        onSuccess={onSuccess}
                                        onUploadStart={() => setUploading(true)}
                                        validateFile={(file: any) => file.size < 10000000} // 10MB
                                    />
                                </IKContext>
                            ) : (
                                <div className="text-red-400">ImageKit 설정이 필요합니다</div>
                            )}
                        </div>
                        {uploading && <p className={`${styles.uploadStatus} text-yellow-400`}>업로드 중...</p>}
                        {uploadedImage && <p className={`${styles.uploadStatus} text-green-400`}>이미지 업로드 완료!</p>}
                    </div>

                    <button type="submit" disabled={uploading} className={styles.submitBtn}>
                        {uploading ? "업로드 중..." : "저장하기"}
                    </button>
                </form>
            </div>
            {showHelp && (
                <div className={styles.modalOverlay} onClick={() => setShowHelp(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.closeBtn} onClick={() => setShowHelp(false)}>
                            <FaTimes />
                        </button>
                        <img src="/category_explanation.png" alt="Category Explanation" className={styles.helpImage} />
                    </div>
                </div>
            )}
        </div>
    );
}
