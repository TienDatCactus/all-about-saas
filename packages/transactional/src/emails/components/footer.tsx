import { Section, Img, Text, Row, Column, Link, Tailwind } from "react-email";
export default function Footer() {
  return (
    <Section className="bg-bg">
      <Row>
        <Column className="px-6 py-10 text-center">
          <Text className="font-13 text-fg-3 mx-auto mt-0 mb-8 max-w-[280px] text-center font-sans">
            Barebones is the catchy slogan that perfectly encapsulates the
            vision of our company.
          </Text>

          <Section className="mb-8">
            <Link
              href="https://example.com/"
              className="inline-block px-2 align-middle"
            >
              <Img
                src={`$cc/static/shared/social-x-black.png`}
                alt="X"
                width={18}
                className="block"
              />
            </Link>
            <Link
              href="https://example.com/"
              className="inline-block px-2 align-middle"
            >
              <Img
                src={`$cc/static/shared/social-in-black.png`}
                alt="LinkedIn"
                width={18}
                className="block"
              />
            </Link>
            <Link
              href="https://example.com/"
              className="inline-block px-2 align-middle"
            >
              <Img
                src={`c/static/shared/social-yt-black.png`}
                alt="YouTube"
                width={18}
                className="block"
              />
            </Link>
            <Link
              href="https://example.com/"
              className="inline-block px-2 align-middle"
            >
              <Img
                src={`c/static/shared/social-gh-black.png`}
                alt="GitHub"
                width={18}
                className="block"
              />
            </Link>
          </Section>

          <Text className="font-11 text-fg-3 mt-4 mb-5 text-center font-sans">
            123 Market Street, Floor 1
            <br />
            Tech City, CA, 94102
          </Text>
          <Text className="font-11 text-fg-3 m-0 text-center font-sans">
            <Link href="https://example.com/" className="text-fg-3">
              Unsubscribe
            </Link>{" "}
            from c marketing emails.
          </Text>
        </Column>
      </Row>
    </Section>
  );
}
