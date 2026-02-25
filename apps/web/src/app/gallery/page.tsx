"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronLeft, Users, Heart, MessageCircle, Share2, Search, Filter } from "lucide-react";
import { useState } from "react";

const MOCK_COMMUNITY_POSTS = [
    {
        id: "post-1",
        title: "Brutalist Zen Garden",
        author: "MARCO_V",
        likes: 1240,
        comments: 42,
        image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "post-2",
        title: "Neon Cyber Loft",
        author: "CYBER_ARC",
        likes: 892,
        comments: 15,
        image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "post-3",
        title: "Organic Curve Villa",
        author: "SOPHIE_L",
        likes: 2105,
        comments: 68,
        image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "post-4",
        title: "Monochrome Study",
        author: "DESIGN_LAB",
        likes: 450,
        comments: 12,
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "post-5",
        title: "Eco-Friendly Hub",
        author: "GREEN_SPACE",
        likes: 3100,
        comments: 120,
        image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "post-6",
        title: "Nordic Minimalist",
        author: "HK_DESIGN",
        likes: 1540,
        comments: 34,
        image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800",
    }
];

export default function CommunityPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");

    return (
        <div className="relative min-h-screen bg-[#fdfdfc] text-[#1a1a1a] pt-32">
            <div className="max-w-7xl mx-auto px-12">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-20 pb-12 border-b border-[#e5e5e0]">
                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 text-[#999999] uppercase tracking-[0.4em] text-[10px] font-bold"
                        >
                            <Users size={14} />
                            <span>Gallery Archive</span>
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-6xl font-cormorant font-light tracking-tight"
                        >
                            PLAN2SPACE GALLERY
                        </motion.h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                            <input
                                type="text"
                                placeholder="Search Archive..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-[#f3f3f1] border border-[#e5e5e0] rounded-sm py-4 pl-14 pr-8 text-[10px] text-black font-bold uppercase tracking-[0.2em] focus:outline-none focus:border-black transition-all w-72"
                            />
                        </div>
                        <button className="p-4 bg-white border border-[#e5e5e0] hover:border-black transition-all">
                            <Filter className="w-4 h-4 text-[#999999]" />
                        </button>
                    </div>
                </header>

                {/* Grid Feed */}
                <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {MOCK_COMMUNITY_POSTS.map((post, idx) => (
                            <motion.div
                                key={post.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="arch-card group flex flex-col rounded-sm overflow-hidden"
                            >
                                {/* Image */}
                                <div className="relative aspect-square overflow-hidden bg-[#f3f3f1]">
                                    <img
                                        src={post.image}
                                        alt={post.title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                    />
                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>

                                <div className="p-8 space-y-8 flex-1 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-[#e5e5e0] pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full border border-[#e5e5e0] flex items-center justify-center text-[10px] font-bold text-black/40">
                                                    {post.author[0]}
                                                </div>
                                                <span className="text-[9px] font-bold tracking-[0.2em] text-[#999999] uppercase">@{post.author}</span>
                                            </div>
                                            <button className="p-2 text-[#999999] hover:text-black transition-colors">
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <h3 className="text-2xl font-cormorant font-light text-black leading-tight group-hover:text-black transition-colors">{post.title}</h3>
                                    </div>

                                    <div className="flex items-center gap-8 border-t border-[#e5e5e0] pt-6 text-[#999999]">
                                        <div className="flex items-center gap-2">
                                            <Heart className="w-4 h-4" />
                                            <span className="text-[10px] font-bold tracking-widest">{post.likes}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4" />
                                            <span className="text-[10px] font-bold tracking-widest">{post.comments}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Floating Back Button removed - use global navbar */}
        </div>
    );
}
