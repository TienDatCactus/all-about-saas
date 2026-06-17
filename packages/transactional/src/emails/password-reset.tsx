import { Button, Heading, Img, Section, Text } from "react-email";
import EmailLayout from "./components/layout";

interface PasswordResetEmailProps {
  url: string;
}

export const PasswordResetEmail = ({ url }: PasswordResetEmailProps) => (
  <EmailLayout title="dat">
    <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[64px] text-center">
      <Section className="mb-3">
        <Img
          src={`${url}/static/shared/logo-black.png`}
          alt="Logo"
          width={48}
          className="mx-auto mb-5 block"
        />
        <Heading as="h1" className="font-28 text-fg m-0 font-sans">
          Reset your password
        </Heading>
      </Section>

      <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[380px] text-center font-sans">
        Someone has requested a link to change your password, and you can do
        this through the link below.
      </Text>

      <Section className="mb-6 text-center">
        <Button
          href={url}
          className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
        >
          Change password
        </Button>
      </Section>

      <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
        If you didn&apos;t request this, please ignore this email. Your password
        won&apos;t change until you access the link above and create a new one.
      </Text>
    </Section>
  </EmailLayout>
);

PasswordResetEmail.PreviewProps = {
  url: "https://example.com/",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
