"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageSquare, Plus, ArrowUpRight } from "lucide-react";

export default function CommunityPage() {
    const router = useRouter();

    return (
        <div className="relative min-h-screen bg-[#fdfdfc] text-[#1a1a1a] pt-32 selection:bg-black/5">
            <div className="max-w-5xl mx-auto px-12">
                <header className="mb-24 space-y-8">
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.4em] text-[#999999]">
                        <MessageSquare size={14} />
                        <span>Plan2Space Community</span>
                    </div>
                    <h1 className="text-7xl font-cormorant font-light tracking-tight leading-none">
                        DESIGN<br />DIALOGUE
                    </h1>
                </header>

                <div className="space-y-1 w-full border-t border-[#e5e5e0]">
                    {[
                        { title: "Optimizing Small Studio Layouts", author: "ArchViz_Pro", replies: 12, category: "Tips" },
                        { title: "Lighting Strategies for High-Ceiling Lofts", author: "Light_Master", replies: 28, category: "Discussion" },
                        { title: "AI Blueprinting: Best Practices", author: "Space_AI", replies: 45, category: "Tech" },
                        { title: "The Rise of Neo-Brutalism in 2024", author: "Design_Thinker", replies: 15, category: "Trends" },
                    ].map((topic, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="group flex items-center justify-between py-10 border-b border-[#e5e5e0] hover:bg-stone-50/50 px-4 transition-all cursor-pointer"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 px-3 py-1 bg-emerald-50 rounded-full">{topic.category}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">BY @{topic.author}</span>
                                </div>
                                <h2 className="text-3xl font-cormorant font-light group-hover:pl-2 transition-all">{topic.title}</h2>
                            </div>
                            <div className="flex items-center gap-12 text-[#999999]">
                                <div className="text-center">
                                    <div className="text-lg font-outfit font-medium text-black">{topic.replies}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest">Replies</div>
                                </div>
                                <ArrowUpRight className="w-6 h-6 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-all opacity-20 group-hover:opacity-100" />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-24 flex justify-between items-center">
                    <button className="flex items-center gap-4 px-10 py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-stone-800 transition-all">
                        <Plus size={14} /> NEW DISCUSSION
                    </button>
                </div>
            </div>

            {/* Floating Back Button removed - use global navbar */}
        </div>
    );
}
