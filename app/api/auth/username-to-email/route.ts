import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ success: false, error: { message: 'Use the sign-in form to authenticate.' } }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
