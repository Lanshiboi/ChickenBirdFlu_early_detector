from flask import Flask, request, jsonify, send_from_directory, render_template
import os
import base64
import cv2
import numpy as np
import detect_and_classify
import database
from flask_cors import CORS

app = Flask(__name__, static_folder='assets', template_folder='.')
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<page>.html')
def serve_page(page):
    return render_template(f'{page}.html')

@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory('assets', path)

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    try:
        # Check if image is in form data (file upload) or JSON
        if 'image' in request.files:
            file = request.files['image']
            if file.filename == '':
                return jsonify({'error': 'No image provided'}), 400
            image_bytes = file.read()
            img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        else:
            # Fallback to JSON with base64
            data = request.get_json()
            image_data_url = data.get('image')
            if not image_data_url:
                return jsonify({'error': 'No image provided'}), 400
            _, encoded = image_data_url.split(',', 1)
            image_bytes = base64.b64decode(encoded)
            img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Image could not be decoded.")

        output_img, classification, temperatures = detect_and_classify.detect_and_classify(img)

        overall_result = classification

        max_temp = None
        if temperatures and 'head' in temperatures and 'body' in temperatures:
            if temperatures['head'] is not None and temperatures['body'] is not None:
                max_temp = max(temperatures['head'], temperatures['body'])
            elif temperatures['head'] is not None:
                max_temp = temperatures['head']
            elif temperatures['body'] is not None:
                max_temp = temperatures['body']

        # Save result to database
        filename = "uploaded_image"  # Placeholder filename
        database.save_result(filename, max_temp if max_temp is not None else 0, overall_result)

        gray_image = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        norm_gray = cv2.normalize(gray_image, None, 0, 255, cv2.NORM_MINMAX)
        heat_pattern_img = cv2.applyColorMap(norm_gray, cv2.COLORMAP_JET)

        _, buffer = cv2.imencode('.png', output_img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        img_data_url = f"data:image/png;base64,{img_base64}"

        _, heat_buffer = cv2.imencode('.png', heat_pattern_img)
        heat_img_base64 = base64.b64encode(heat_buffer).decode('utf-8')
        heat_img_data_url = f"data:image/png;base64,{heat_img_base64}"

        return jsonify({
            'result': overall_result,
            'average_temperature': max_temp,
            'temperatures': {
                'head': float(temperatures.get('head')) if temperatures.get('head') is not None and not (isinstance(temperatures.get('head'), float) and np.isnan(temperatures.get('head'))) else None,
                'body': float(temperatures.get('body')) if temperatures.get('body') is not None and not (isinstance(temperatures.get('body'), float) and np.isnan(temperatures.get('body'))) else None,
                'body_min': float(temperatures.get('body_min')) if temperatures.get('body_min') is not None and not (isinstance(temperatures.get('body_min'), float) and np.isnan(temperatures.get('body_min'))) else None,
                'body_max': float(temperatures.get('body_max')) if temperatures.get('body_max') is not None and not (isinstance(temperatures.get('body_max'), float) and np.isnan(temperatures.get('body_max'))) else None,
                'leg': float(temperatures.get('leg')) if temperatures.get('leg') is not None and not (isinstance(temperatures.get('leg'), float) and np.isnan(temperatures.get('leg'))) else None
            },
            'confidence': None,
            'image': img_data_url,
            'heat_pattern_image': heat_img_data_url
        })

    except Exception as e:
        return jsonify({'error': f"Error analyzing image: {str(e)}"}), 500

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    # Fetch real data from database
    results = database.get_all_results()
    healthy_count = sum(1 for r in results if r[3] == 'Healthy')
    sick_count = sum(1 for r in results if r[3] == 'Suspected Bird Flu')
    invalid_count = sum(1 for r in results if r[3] == 'Invalid Image')

    recent_alerts = []
    for r in results[-3:]:  # Last 3 results (most recent)
        recent_alerts.append({
            'date': r[4],
            'chicken_id': f'CHK_{r[0]}',
            'status': r[3],
            'id': str(r[0])
        })

    return jsonify({
        'stats': {
            'healthy': healthy_count,
            'sick': sick_count,
            'total': len(results)
        },
        'recent_alerts': recent_alerts,
        'health_trend': {
            'labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            'healthy': [2, 3, 2, 4, 3, 2, 1],  # Placeholder, can be updated with real data
            'sick': [0, 1, 0, 1, 0, 1, 0]
        },
        'distribution': {
            'healthy': healthy_count,
            'sick': sick_count
        }
    })

@app.route('/api/details/<alert_id>', methods=['GET'])
def show_details(alert_id):
    details = {
        '1': {'info': 'Details for alert 1'},
        '2': {'info': 'Details for alert 2'},
        '3': {'info': 'Details for alert 3'}
    }
    return jsonify(details.get(alert_id, {'info': 'No details found'}))

@app.route('/api/get_analyses', methods=['GET'])
def get_analyses():
    # Fetch real data from database
    results = database.get_all_results()
    analyses = []
    for r in results:
        analyses.append({
            'id': str(r[0]),
            'date': r[4],
            'chickenId': f'CHK_{r[0]}',
            'status': r[3],
            'image': '',  # Placeholder, as we don't store images in DB
            'heatPattern': '',  # Placeholder
            'temperature': float(r[2]) if isinstance(r[2], (int, float)) or (isinstance(r[2], str) and r[2].replace('.', '').isdigit()) else None
        })
    return jsonify({'analyses': analyses})

@app.route('/api/save_analysis', methods=['POST'])
def save_analysis():
    try:
        data = request.get_json()
        # Save to database with proper fields
        database.save_result(data.get('chicken_id', 'unknown'), data.get('temperature', 0), data.get('status', 'Unknown'))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/delete_analysis/<analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    try:
        # Assuming database.delete_result exists
        database.delete_result(int(analysis_id))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/reports', methods=['GET'])
def get_reports_data():
    # Fetch real data from database
    results = database.get_all_results()
    reports = []
    for r in results:
        reports.append({
            'id': f'R{r[0]}',
            'date': r[4],
            'summary': f'Analysis result: {r[3]} with temperature {r[2]}°C',
            'status': r[3]
        })
    return jsonify(reports)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
