from setuptools import find_packages, setup

setup(
    name="worksphere-processing",
    version="0.1.0",
    packages=find_packages(exclude=["tests*"]),
    install_requires=[
        "pydantic>=2.0",
        "python-dateutil>=2.8.2",
    ],
    entry_points={
        "console_scripts": [
            "worksphere-process=worksphere_processing.cli:main",
        ],
    },
)
