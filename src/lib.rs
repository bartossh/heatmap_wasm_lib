#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

extern crate nalgebra as na;
extern crate js_sys;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use na::{Matrix, Dynamic, VecStorage, DMatrix, geometry::Point2, distance};
// #[wasm_bindgen]
// extern {
    
// }

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HeatMapGread {
    matrix: Matrix<u32, Dynamic, Dynamic, VecStorage<u32, Dynamic, Dynamic>>,
    cell_spacing: u32,
    brush_radius: u32,
    brush_intensity: u32,
    x_start: u32,
    y_start: u32,
}

#[wasm_bindgen]
impl HeatMapGread {
    
    pub fn new(width: usize,
        height: usize,
        cell_spacing: u32,
        brush_radius: u32,
        brush_intensity: u32,
        x_start: u32,
        y_start: u32,) -> Self {
        let matrix = DMatrix::from_fn(height, width, |_, _| 0_u32);
        console_log!("Created {} - {}", &width, &height);
        Self {matrix, cell_spacing, brush_radius, brush_intensity, x_start, y_start}
    }

    pub fn update(&mut self, x: u32, y: u32, heat: u32, can_apply: bool) {
        let mut matrix_copy = self.matrix.clone_owned();
        let height = &self.matrix.nrows();
        let width = &self.matrix.ncols();
        let mut row = 0;
        let mut first_row = true;
        let coordinates: Point2<f64> = Point2::new(x as f64, y as f64);
        let cell_spacing = self.cell_spacing;
        let brush_radius = self.brush_radius;
        let brush_intensity = self.brush_intensity;
        let x_start = self.x_start;
        let y_start = self.y_start;
        &self.matrix.iter_mut().enumerate().for_each(|(i, v)| {
            let column = (i as f64 % *height as f64) as u32;
            if column == 0 && !first_row {
                row += 1;
            }
            if matrix_copy[i] > 0 {
                matrix_copy[i] -= 1;
            }
            // todo: calculate gradient dissipation here
            if can_apply {
                let point: Point2<f64> = Point2::new((column * cell_spacing + x_start) as f64, (row * cell_spacing + y_start) as f64);
                let distance_from_coordinates = distance(&coordinates, &point);
                if distance_from_coordinates < (brush_radius * cell_spacing) as f64 {
                    matrix_copy[i] = map_value(distance_from_coordinates, 0_f64, (brush_radius + cell_spacing) as f64, brush_intensity as f64, 0_f64) as u32;                }
                *v = column;
            }
            first_row = false;
        });
        console_log!("{:?}", &self.matrix);
    }

    pub fn test_js_call(&self, callback: &js_sys::Function, num: f64) {
         console_log!("{:?}", callback.call1(&JsValue::null(), &JsValue::from_f64(num)).unwrap());
    }
}

fn map_value(value: f64, from_start: f64, from_finnish: f64, to_start: f64, to_finnish: f64) -> f64 {
    to_start + (value * (to_finnish - to_start) / (from_finnish - to_start)).abs()
}