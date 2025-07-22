"use client";
import React from "react";
import { WavyBackground } from "@/components/ui/wavy-background";

export function WavyBackgroundDemo() {
  return (
    <WavyBackground 
      className="max-w-4xl mx-auto pb-40"
      backgroundFill="#f1f5f9"
      waveOpacity={0.3}
      speed="slow"
    >
      <div className="text-center space-y-6">
        <h1 className="font-playfair text-4xl md:text-6xl lg:text-7xl text-slate-800 font-light tracking-tight">
          Image Optimizer
        </h1>
        <p className="text-base md:text-lg text-slate-600 font-light max-w-2xl mx-auto leading-relaxed">
          Professional image compression with elegant simplicity. 
          Optimize your photos with precision and style.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button className="px-8 py-3 bg-slate-800 text-white font-light tracking-wide hover:bg-slate-700 transition-colors">
            Get Started
          </button>
          <button className="px-8 py-3 border border-slate-300 text-slate-700 font-light tracking-wide hover:bg-slate-50 transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </WavyBackground>
  );
}