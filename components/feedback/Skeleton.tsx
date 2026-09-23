import React from 'react';

export const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200/70 rounded-2xl ${className}`} />
);

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      {/* Top Header skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-3">
          <SkeletonBox className="h-6 w-48 rounded-full" />
          <SkeletonBox className="h-10 w-80" />
          <SkeletonBox className="h-4 w-96" />
        </div>
        <SkeletonBox className="h-48 w-full lg:w-96 rounded-3xl" />
      </div>

      {/* 3 Parameter cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonBox className="h-36 rounded-3xl" />
        <SkeletonBox className="h-36 rounded-3xl" />
        <SkeletonBox className="h-36 rounded-3xl" />
      </div>

      {/* Portfolio summary */}
      <SkeletonBox className="h-64 rounded-3xl" />
    </div>
  );
};

export const ArenaSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="space-y-2">
        <SkeletonBox className="h-9 w-64" />
        <SkeletonBox className="h-5 w-96" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <SkeletonBox className="h-[460px] rounded-3xl" />
          <SkeletonBox className="h-[460px] rounded-3xl" />
        </div>
        <div className="space-y-6">
          <SkeletonBox className="h-80 rounded-3xl" />
          <SkeletonBox className="h-60 rounded-3xl" />
        </div>
      </div>
    </div>
  );
};

export const PortfolioSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="space-y-2">
        <SkeletonBox className="h-9 w-72" />
        <SkeletonBox className="h-5 w-80" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonBox className="h-32 rounded-3xl" />
        <SkeletonBox className="h-32 rounded-3xl" />
        <SkeletonBox className="h-32 rounded-3xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SkeletonBox className="h-96 rounded-3xl" />
        </div>
        <div className="space-y-6">
          <SkeletonBox className="h-64 rounded-3xl" />
          <SkeletonBox className="h-44 rounded-3xl" />
        </div>
      </div>
    </div>
  );
};

export const AdminSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <SkeletonBox key={i} className="h-28 rounded-3xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SkeletonBox className="h-[520px] rounded-3xl" />
        </div>
        <div>
          <SkeletonBox className="h-[520px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
};
