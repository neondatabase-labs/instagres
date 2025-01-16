import { ClipboardCheck, ClipboardCopy } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "./button";

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(textToCopy);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy: ", err);
		}
	};

	return (
		<Button
			onClick={handleCopy}
			className="absolute right-1 top-1 px-2"
			variant="outline"
			size={"sm"}
		>
			{copied ? (
				<ClipboardCheck className="text-green-600" />
			) : (
				<ClipboardCopy />
			)}
		</Button>
	);
};

export default CopyButton;
