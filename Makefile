build-wheel:
	@echo "Building wheel package with version: $$(cat version)"
	@mkdir -p dist
	python setup.py bdist_wheel --dist-dir=whl
	@echo "Wheel package created in whl/ directory"
