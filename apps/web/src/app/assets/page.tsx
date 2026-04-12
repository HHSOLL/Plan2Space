"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronLeft, Package, Search, Filter } from "lucide-react";
import { useState } from "react";

const MOCK_ASSETS = [
    {
        id: "asset-1",
        name: "Minimalist Lounge Chair",
        category: "Seating",
        price: "$890",
        image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "asset-2",
        name: "Architectural Side Table",
        category: "Tables",
        price: "$450",
        image: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "asset-3",
        name: "Concrete Pendant Light",
        category: "Lighting",
        price: "$320",
        image: "https://images.unsplash.com/photo-1507473884658-c7a36422dd56?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "asset-4",
        name: "Wool Textured Rug",
        category: "Decor",
        price: "$1,200",
        image: "https://images.unsplash.com/photo-1575414003591-ece8d0416c7a?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "asset-5",
        name: "Oak Dining Table",
        category: "Tables",
        price: "$2,400",
        image: "https://images.unsplash.com/photo-1577146333355-bd3ee8b92975?auto=format&fit=crop&q=80&w=800",
    },
    {
        id: "asset-6",
        name: "Leather Executive Sofa",
        category: "Seating",
        price: "$4,500",
        image: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=800",
    }
];

export default function AssetsPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");

    return (
        <div className="relative min-h-screen bg-[#fdfdfc] text-[#1a1a1a] pt-32">
            <div className="max-w-7xl mx-auto px-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-20 pb-12 border-b border-[#e5e5e0]">
                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 text-[#999999] uppercase tracking-[0.4em] text-[10px] font-bold"
                        >
                            <Package size={14} />
                            <span>Digital Asset Library</span>
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-6xl font-light tracking-tight"
                        >
                            CURATED ASSETS
                        </motion.h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20" />
                            <input
                                type="text"
                                placeholder="Search Assets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-[#f3f3f1] border border-[#e5e5e0] rounded-sm py-4 pl-14 pr-8 text-[10px] text-black font-bold uppercase tracking-[0.2em] focus:outline-none focus:border-black transition-all w-72"
                            />
                        </div>
                    </div>
                </header>

                <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
                    {MOCK_ASSETS.map((asset, idx) => (
                        <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group flex flex-col border border-[#e5e5e0] bg-white rounded-sm overflow-hidden"
                        >
                            <div className="relative aspect-[4/5] overflow-hidden bg-[#f3f3f1]">
                                <img
                                    src={asset.image}
                                    alt={asset.name}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />
                            </div>
                            <div className="p-8 space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">
                                    {asset.category}
                                </div>
                                <h3 className="text-2xl font-light">{asset.name}</h3>
                                <div className="flex items-center justify-between pt-4 border-t border-[#f3f3f1]">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{asset.price}</span>
                                    <button className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#999999] hover:text-black transition-colors">
                                        VIEW DETAILS
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <button
                onClick={() => router.push("/")}
                className="fixed bottom-12 left-12 p-5 bg-white border border-[#e5e5e0] hover:border-black rounded-full transition-all z-50 group shadow-sm"
            >
                <ChevronLeft className="w-5 h-5 text-[#999999] group-hover:text-black transition-colors" />
            </button>
        </div>
    );
}
