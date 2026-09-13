"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/ChatView";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  return <ChatView characterId={params.id} />;
}
