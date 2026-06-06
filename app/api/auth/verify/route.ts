import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { secret } = await request.json()
  const adminSecret = process.env.ADMIN_PATH_SECRET
  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ success: false }, { status: 401 })
  }
  return NextResponse.json({ success: true })
}
