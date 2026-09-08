import * as React from "react";
import EmailLayout from "./_components/layout";
import { baseURL } from "./utils";

export interface TeacherRoomReminderEmailProps {
  companyName: string;
  title: string;
  subtitle: string;
  legend: string;
  url: string;
}

export const TeacherRoomReminderEmail = ({
  companyName = "All About SaaS",
  title,
  subtitle,
  legend,
  url = "https://example.com/",
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
    />
  );
};

TeacherRoomReminderEmail.PreviewProps = {
  companyName: "All About SaaS",
  title: "Buổi dạy hôm nay chưa chốt trạng thái",
  subtitle: 'Các buổi sau vẫn đang ở trạng thái "chưa chốt": An 15:00–16:00; Bình 17:00–18:00',
  legend: "Nhấn nút bên dưới để chốt buổi hôm nay: đánh dấu đã dạy xong, dời lịch, hoặc huỷ nếu không diễn ra.",
  url: "https://example.com/teacher-room",
} satisfies TeacherRoomReminderEmailProps;

export default TeacherRoomReminderEmail;
