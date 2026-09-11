import * as React from "react";
import EmailLayout from "./_components/layout";
import EmailListSection from "./_components/list-section";
import type { EmailListItem } from "./_components/list-section";
import { baseURL } from "./utils";

export interface TeacherRoomReminderEmailProps {
  companyName: string;
  title: string;
  subtitle: string;
  legend: string;
  url: string;
  /** One row per session — used by the daily digest, where the content is a
   *  list rather than a single sentence. Pre/post-class reminders (always
   *  about one session) omit this. */
  items?: EmailListItem[];
}

export const TeacherRoomReminderEmail = ({
  companyName = "All About SaaS",
  title,
  subtitle,
  legend,
  url = "https://example.com/",
  items,
}: TeacherRoomReminderEmailProps) => {
  return (
    <EmailLayout
      content={{
        title,
        subtitle,
        legend,
        brand: companyName,
        cta: {
          text: "Xem lịch dạy hôm nay",
          url: url,
        },
      }}
      image={{
        type: "logo",
        src: `${baseURL}/logo/logo.png`,
        alt: "Logo",
        size: {
          width: 148,
          height: 111,
        },
      }}
    >
      {items && <EmailListSection items={items} />}
    </EmailLayout>
  );
};

TeacherRoomReminderEmail.PreviewProps = {
  companyName: "All About SaaS",
  title: "Buổi dạy hôm nay chưa chốt trạng thái",
  subtitle: "Các buổi sau vẫn đang ở trạng thái \"chưa chốt\":",
  legend:
    "Nhấn nút bên dưới để chốt buổi hôm nay: đánh dấu đã dạy xong, dời lịch, hoặc huỷ nếu không diễn ra.",
  url: "https://example.com/teacher-room",
  items: [
    { title: "An · 15:00–16:00", description: "Ưu tiên cao" },
    { title: "Bình · 17:00–18:00" },
  ],
} satisfies TeacherRoomReminderEmailProps;

export default TeacherRoomReminderEmail;
