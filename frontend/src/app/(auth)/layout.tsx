import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-secondary-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white text-xl font-bold">
            W
          </div>
          <h1 className="text-xl font-bold text-secondary-900">WorkSphere</h1>
          <p className="text-xs text-secondary-500">Multi-Tenant Project & Workflow Automation</p>
        </div>
        {children}
      </div>
    </div>
  );
}
