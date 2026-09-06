import unittest

from backend.services.payload_builder import PayloadBuilder


class PromptInterpolationTests(unittest.TestCase):
    def setUp(self):
        self.builder = object.__new__(PayloadBuilder)

    def test_interpolates_single_resource_and_expands_each(self):
        rendered = self.builder._render(
            {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": "{{instructions.text}}"}],
                        "$each": {
                            "resource": "line_crops",
                            "into": "parts",
                            "template": {"text": "{{line_crops.artifact_name}}"},
                        },
                    }
                ]
            },
            {
                "instructions": [{"text": "Read every crop."}],
                "line_crops": [
                    {"artifact_name": "crop-1"},
                    {"artifact_name": "crop-2"},
                ],
            },
            {"sample_id": "sample-1"},
            {},
        )

        self.assertEqual(
            rendered["contents"][0]["parts"],
            [
                {"text": "Read every crop."},
                {"text": "crop-1"},
                {"text": "crop-2"},
            ],
        )

    def test_preserves_blob_for_inline_data(self):
        rendered = self.builder._render(
            {"inline_data": {"mime_type": "image/png", "data": "{{sample.sample_blob}}"}},
            {},
            {"sample_blob": b"image-bytes"},
            {},
        )

        self.assertEqual(b"image-bytes", rendered["inline_data"]["data"])


if __name__ == "__main__":
    unittest.main()
